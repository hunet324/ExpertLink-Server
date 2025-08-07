import { Expose, Type } from 'class-transformer';
import { TestLogicType } from '../../entities/psych-test.entity';
import { QuestionType } from '../../entities/psych-question.entity';

export class QuestionOptionDto {
  @Expose()
  value: string | number;

  @Expose()
  text: string;

  @Expose()
  score?: number;
}

export class PsychQuestionDto {
  @Expose()
  id: number;

  @Expose()
  question: string;

  @Expose()
  question_order: number;

  @Expose()
  question_type: QuestionType;

  @Expose()
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];

  @Expose()
  is_required: boolean;

  @Expose()
  help_text?: string;
}

export class PsychTestListDto {
  @Expose()
  id: number;

  @Expose()
  title: string;

  @Expose()
  description: string;

  @Expose()
  logic_type: TestLogicType;

  @Expose()
  estimated_time: number;

  @Expose()
  instruction: string;

  @Expose()
  questions_count?: number; // 문항 수

  @Expose()
  is_completed?: boolean; // 사용자가 완료했는지 여부

  @Expose()
  @Type(() => Date)
  last_completed_at?: Date; // 마지막 완료 시간
}

export class PsychTestDetailDto extends PsychTestListDto {
  @Expose()
  @Type(() => PsychQuestionDto)
  questions: PsychQuestionDto[];

  @Expose()
  scoring_rules: Record<string, any>;

  @Expose()
  result_ranges: Record<string, any>;
}