import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PsychTest, TestLogicType } from '../entities/psych-test.entity';
import { PsychQuestion } from '../entities/psych-question.entity';
import { PsychAnswer } from '../entities/psych-answer.entity';
import { PsychResult } from '../entities/psych-result.entity';
import { PsychTestListDto, PsychTestDetailDto } from './dto/psych-test-response.dto';
import { SubmitAnswersDto, SubmitAnswersResponseDto } from './dto/submit-answers.dto';
import { PsychResultDto } from './dto/psych-result-response.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class PsychTestsService {
  constructor(
    @InjectRepository(PsychTest)
    private psychTestRepository: Repository<PsychTest>,
    @InjectRepository(PsychQuestion)
    private psychQuestionRepository: Repository<PsychQuestion>,
    @InjectRepository(PsychAnswer)
    private psychAnswerRepository: Repository<PsychAnswer>,
    @InjectRepository(PsychResult)
    private psychResultRepository: Repository<PsychResult>,
    private dataSource: DataSource,
  ) {}

  async getPsychTests(userId?: number): Promise<PsychTestListDto[]> {
    const query = this.psychTestRepository
      .createQueryBuilder('test')
      .leftJoin('test.questions', 'question')
      .addSelect('COUNT(question.id)', 'questions_count')
      .where('test.is_active = :isActive', { isActive: true })
      .groupBy('test.id')
      .orderBy('test.created_at', 'DESC');

    let tests = await query.getRawAndEntities();

    let testListDto = tests.entities.map((test, index) => {
      const dto = plainToClass(PsychTestListDto, test, { excludeExtraneousValues: true });
      dto.questions_count = parseInt(tests.raw[index].questions_count) || 0;
      return dto;
    });

    // 사용자가 로그인한 경우 완료 정보 추가
    if (userId) {
      testListDto = await this.addCompletionInfo(testListDto, userId);
    }

    return testListDto;
  }

  async getPsychTestById(testId: number, userId?: number): Promise<PsychTestDetailDto> {
    const test = await this.psychTestRepository.findOne({
      where: { id: testId, is_active: true },
      relations: ['questions'],
    });

    if (!test) {
      throw new NotFoundException('설문을 찾을 수 없습니다.');
    }

    // 문항을 순서대로 정렬
    test.questions.sort((a, b) => a.question_order - b.question_order);

    const testDetail = plainToClass(PsychTestDetailDto, test, {
      excludeExtraneousValues: true,
    });

    // 사용자가 이미 완료했는지 확인
    if (userId) {
      const existingResult = await this.psychResultRepository.findOne({
        where: { user_id: userId, test_id: testId },
        order: { completed_at: 'DESC' },
      });

      testDetail.is_completed = !!existingResult;
      testDetail.last_completed_at = existingResult?.completed_at;
    }

    return testDetail;
  }

  async submitAnswers(
    testId: number,
    userId: number,
    submitAnswersDto: SubmitAnswersDto,
  ): Promise<SubmitAnswersResponseDto> {
    // 트랜잭션으로 처리
    return await this.dataSource.transaction(async manager => {
      // 설문 유효성 검증
      const test = await manager.findOne(PsychTest, {
        where: { id: testId, is_active: true },
        relations: ['questions'],
      });

      if (!test) {
        throw new NotFoundException('설문을 찾을 수 없습니다.');
      }

      // 문항 수 검증
      const totalQuestions = test.questions.length;
      const answeredQuestions = submitAnswersDto.answers.length;

      if (answeredQuestions !== totalQuestions) {
        throw new BadRequestException(
          `모든 문항에 답변해주세요. (${answeredQuestions}/${totalQuestions})`
        );
      }

      // 기존 답변 삭제 (재검사의 경우)
      await manager.delete(PsychAnswer, {
        user_id: userId,
        question_id: test.questions.map(q => q.id) as any,
      });

      // 새 답변 저장
      const answers = [];
      let totalScore = 0;

      for (const answerDto of submitAnswersDto.answers) {
        const question = test.questions.find(q => q.id === answerDto.question_id);
        if (!question) {
          throw new BadRequestException(`유효하지 않은 문항 ID: ${answerDto.question_id}`);
        }

        // 점수 계산
        let score = 0;
        if (question.options && Array.isArray(question.options)) {
          const option = question.options.find(opt => opt.value.toString() === answerDto.answer_value);
          if (option && typeof option.score === 'number') {
            score = option.score;
          }
        }

        const answer = manager.create(PsychAnswer, {
          user_id: userId,
          question_id: answerDto.question_id,
          answer_value: answerDto.answer_value,
          score: score,
        });

        answers.push(answer);
        totalScore += score;
      }

      await manager.save(PsychAnswer, answers);

      // 결과 계산
      const resultData = this.calculateResult(test, answers, totalScore);

      // 기존 결과 삭제 후 새 결과 저장
      await manager.delete(PsychResult, {
        user_id: userId,
        test_id: testId,
      });

      const result = manager.create(PsychResult, {
        user_id: userId,
        test_id: testId,
        total_score: resultData.totalScore,
        result_type: resultData.resultType,
        result_description: resultData.description,
        result_details: resultData.details,
      });

      const savedResult = await manager.save(PsychResult, result);

      return {
        message: '설문이 성공적으로 완료되었습니다.',
        result_id: savedResult.id,
        result_type: resultData.resultType,
        result_description: resultData.description,
        total_score: resultData.totalScore,
        result_details: resultData.details,
      };
    });
  }

  async getUserPsychResults(userId: number): Promise<PsychResultDto[]> {
    const results = await this.psychResultRepository.find({
      where: { user_id: userId },
      relations: ['test'],
      order: { completed_at: 'DESC' },
    });

    return results.map(result => {
      const dto = plainToClass(PsychResultDto, result, { excludeExtraneousValues: true });
      dto.test_title = result.test.title;
      return dto;
    });
  }

  private async addCompletionInfo(
    tests: PsychTestListDto[],
    userId: number,
  ): Promise<PsychTestListDto[]> {
    const testIds = tests.map(test => test.id);
    
    const results = await this.psychResultRepository.find({
      where: {
        user_id: userId,
        test_id: testIds.length === 1 ? testIds[0] : testIds as any,
      },
      order: { completed_at: 'DESC' },
    });

    const resultMap = new Map(results.map(result => [result.test_id, result]));

    return tests.map(test => {
      const result = resultMap.get(test.id);
      test.is_completed = !!result;
      test.last_completed_at = result?.completed_at;
      return test;
    });
  }

  private calculateResult(
    test: PsychTest,
    answers: PsychAnswer[],
    totalScore: number,
  ): {
    totalScore: number;
    resultType: string;
    description: string;
    details: Record<string, any>;
  } {
    switch (test.logic_type) {
      case TestLogicType.SCALE:
        return this.calculateScaleResult(test, totalScore);

      case TestLogicType.MBTI:
        return this.calculateMBTIResult(test, answers);

      case TestLogicType.CATEGORY:
        return this.calculateCategoryResult(test, answers);

      default:
        return {
          totalScore,
          resultType: '완료',
          description: '설문이 완료되었습니다.',
          details: { total_score: totalScore },
        };
    }
  }

  private calculateScaleResult(
    test: PsychTest,
    totalScore: number,
  ): { totalScore: number; resultType: string; description: string; details: Record<string, any> } {
    const ranges = test.result_ranges || {};
    
    for (const [rangeName, range] of Object.entries(ranges)) {
      const rangeObj = range as { min: number; max: number; description: string };
      if (totalScore >= rangeObj.min && totalScore <= rangeObj.max) {
        return {
          totalScore,
          resultType: rangeName,
          description: rangeObj.description,
          details: {
            total_score: totalScore,
            max_score: test.max_score,
            percentage: test.max_score ? Math.round((totalScore / test.max_score) * 100) : 0,
            level: rangeName,
          },
        };
      }
    }

    return {
      totalScore,
      resultType: '일반',
      description: '설문이 완료되었습니다.',
      details: { total_score: totalScore },
    };
  }

  private calculateMBTIResult(
    test: PsychTest,
    answers: PsychAnswer[],
  ): { totalScore: number; resultType: string; description: string; details: Record<string, any> } {
    // 간단한 MBTI 로직 (실제로는 더 복잡한 로직 필요)
    const dimensions = {
      E: 0, I: 0, // 외향/내향
      S: 0, N: 0, // 감각/직관
      T: 0, F: 0, // 사고/감정
      J: 0, P: 0, // 판단/인식
    };

    // 답변을 기반으로 각 차원별 점수 계산
    answers.forEach(answer => {
      const value = answer.answer_value.toUpperCase();
      if (dimensions.hasOwnProperty(value)) {
        dimensions[value]++;
      }
    });

    const resultType = 
      (dimensions.E > dimensions.I ? 'E' : 'I') +
      (dimensions.S > dimensions.N ? 'S' : 'N') +
      (dimensions.T > dimensions.F ? 'T' : 'F') +
      (dimensions.J > dimensions.P ? 'J' : 'P');

    const descriptions = {
      'ENFJ': '선생님형 - 따뜻하고 적극적이며 책임감이 강합니다.',
      'ENFP': '스파크형 - 열정적이고 상상력이 풍부합니다.',
      'ENTJ': '지휘관형 - 타고난 리더십으로 목표를 달성합니다.',
      'ENTP': '발명가형 - 창의적이고 새로운 가능성을 추구합니다.',
      'ESFJ': '친선도모형 - 사교적이고 타인을 배려합니다.',
      'ESFP': '사교형 - 활발하고 즐거운 분위기를 만듭니다.',
      'ESTJ': '사업가형 - 체계적이고 실용적입니다.',
      'ESTP': '모험가형 - 현실적이고 적응력이 뛰어납니다.',
      'INFJ': '예언자형 - 통찰력이 뛰어나고 이상주의적입니다.',
      'INFP': '잔다르크형 - 이상주의적이고 충성심이 강합니다.',
      'INTJ': '건축가형 - 독창적이고 의지가 강합니다.',
      'INTP': '아이디어뱅크형 - 논리적이고 지적 호기심이 강합니다.',
      'ISFJ': '수호자형 - 온화하고 신중하며 책임감이 강합니다.',
      'ISFP': '성인군자형 - 겸손하고 친근하며 예술적입니다.',
      'ISTJ': '현실주의자형 - 신중하고 꼼꼼하며 보수적입니다.',
      'ISTP': '백과사전형 - 과묵하고 분석적입니다.',
    };

    return {
      totalScore: 0,
      resultType,
      description: descriptions[resultType] || `당신의 MBTI는 ${resultType}입니다.`,
      details: {
        mbti_type: resultType,
        dimensions: {
          EI: { E: dimensions.E, I: dimensions.I },
          SN: { S: dimensions.S, N: dimensions.N },
          TF: { T: dimensions.T, F: dimensions.F },
          JP: { J: dimensions.J, P: dimensions.P },
        },
      },
    };
  }

  private calculateCategoryResult(
    test: PsychTest,
    answers: PsychAnswer[],
  ): { totalScore: number; resultType: string; description: string; details: Record<string, any> } {
    // 카테고리별 점수 집계
    const categories = {};
    
    answers.forEach(answer => {
      const category = answer.answer_value;
      categories[category] = (categories[category] || 0) + 1;
    });

    // 가장 높은 점수의 카테고리 찾기
    const topCategory = Object.keys(categories).reduce((a, b) => 
      categories[a] > categories[b] ? a : b
    );

    return {
      totalScore: 0,
      resultType: topCategory,
      description: `당신에게 가장 적합한 유형은 "${topCategory}"입니다.`,
      details: {
        category_scores: categories,
        recommended_category: topCategory,
      },
    };
  }
}