import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, DataSource } from 'typeorm';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { User, UserType, UserStatus } from '../entities/user.entity';
import { ExpertSearchDto } from './dto/expert-search.dto';
import { ExpertListResponseDto, ExpertDetailResponseDto } from './dto/expert-response.dto';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { plainToClass } from 'class-transformer';
import { CacheService } from '../common/services/cache.service';
// import { SchedulesService } from '../schedules/schedules.service'; // Removed - schedules migrated to counselings

@Injectable()
export class ExpertsService {
  constructor(
    @InjectRepository(ExpertProfile)
    private expertsRepository: Repository<ExpertProfile>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private cacheService: CacheService,
    // private schedulesService: SchedulesService, // Removed - schedules migrated to counselings
    private dataSource: DataSource,
  ) {}

  async searchExperts(searchDto: ExpertSearchDto): Promise<{ experts: ExpertListResponseDto[]; total: number; page: number; totalPages: number }> {
    const { search, specialization, min_experience, max_hourly_rate, page = 1, limit = 10, sort = 'created_at', order = 'DESC' } = searchDto;

    // 캐시 키 생성
    const cacheKey = `experts:search:${JSON.stringify(searchDto)}`;
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const query = this.expertsRepository
          .createQueryBuilder('expert')
          .leftJoinAndSelect('expert.user', 'user')
          .where('user.user_type = :userType', { userType: UserType.EXPERT })
          .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
          .andWhere('expert.is_verified = :verified', { verified: true });

        // 검색어 필터
        if (search) {
          query.andWhere(
            '(user.name ILIKE :search OR expert.introduction ILIKE :search)',
            { search: `%${search}%` }
          );
        }

        // 전문분야 필터
        if (specialization && specialization.length > 0) {
          query.andWhere('expert.specialization && :specialization', { 
            specialization 
          });
        }

        // 경력 필터
        if (min_experience !== undefined) {
          query.andWhere('expert.years_experience >= :min_experience', { min_experience });
        }

        // 시급 필터
        if (max_hourly_rate !== undefined) {
          query.andWhere('expert.hourly_rate <= :max_hourly_rate', { max_hourly_rate });
        }

        // 정렬
        const sortField = this.getSortField(sort);
        query.orderBy(sortField, order);

        // 페이지네이션
        const offset = (page - 1) * limit;
        query.skip(offset).take(limit);

        const [experts, total] = await query.getManyAndCount();

        const expertDtos = experts.map(expert => 
          plainToClass(ExpertListResponseDto, expert, {
            excludeExtraneousValues: true,
          })
        );

        return {
          experts: expertDtos,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        };
      },
      600, // 10분 캐시
      ['experts']
    );
  }

  async getExpertDetail(id: number): Promise<ExpertDetailResponseDto> {
    const cacheKey = `expert:detail:${id}`;
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const expert = await this.expertsRepository
          .createQueryBuilder('expert')
          .leftJoinAndSelect('expert.user', 'user')
          .where('expert.id = :id', { id })
          .andWhere('user.user_type = :userType', { userType: UserType.EXPERT })
          .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
          .getOne();

        if (!expert) {
          throw new NotFoundException('전문가를 찾을 수 없습니다.');
        }

        return plainToClass(ExpertDetailResponseDto, expert, {
          excludeExtraneousValues: true,
        });
      },
      1800, // 30분 캐시
      [`expert:${id}`, 'experts']
    );
  }

  async getExpertProfile(userId: number): Promise<ExpertDetailResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user || user.user_type !== UserType.EXPERT) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    let expert = await this.expertsRepository
      .createQueryBuilder('expert')
      .where('expert.user_id = :userId', { userId })
      .getOne();

    // 전문가 프로필이 없으면 생성
    if (!expert) {
      expert = this.expertsRepository.create({
        user_id: userId,
        user,
        specialization: [],
        years_experience: 0,
        hourly_rate: 0,
        certifications: [],
        available_hours: {},
        consultation_settings: { video: true, chat: true, voice: true },
        pricing_settings: { video: 0, chat: 0, voice: 0 },
      });
      await this.expertsRepository.save(expert);
    }

    // 완전한 사용자 정보를 포함하여 expert 로드
    expert = await this.expertsRepository
      .createQueryBuilder('expert')
      .leftJoinAndSelect('expert.user', 'user')
      .where('expert.user_id = :userId', { userId })
      .getOne();

    // 프로필이 없으면 다시 생성하고 사용자 정보 포함
    if (!expert) {
      expert = this.expertsRepository.create({
        user_id: userId,
        user,
        specialization: [],
        years_experience: 0,
        hourly_rate: 0,
        certifications: [],
        available_hours: {},
        consultation_settings: { video: true, chat: true, voice: true },
        pricing_settings: { video: 0, chat: 0, voice: 0 },
      });
      await this.expertsRepository.save(expert);
      expert.user = user; // 완전한 사용자 정보 할당
    }

    return plainToClass(ExpertDetailResponseDto, expert, {
      excludeExtraneousValues: true,
    });
  }

  async updateExpertProfile(userId: number, updateDto: UpdateExpertProfileDto): Promise<ExpertDetailResponseDto> {
    console.log('=== 프로필 업데이트 요청 ===');
    console.log('userId:', userId);
    console.log('updateDto:', JSON.stringify(updateDto, null, 2));
    console.log('availableHours:', updateDto.availableHours);
    console.log('available_hours:', updateDto.available_hours);

    // availableHours 데이터 검증
    if (updateDto.available_hours) {
      this.validateAvailableHours(updateDto.available_hours);
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user || user.user_type !== UserType.EXPERT) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    let expert = await this.expertsRepository
      .createQueryBuilder('expert')
      .leftJoinAndSelect('expert.user', 'user')
      .addSelect(['user.email', 'user.phone'])
      .where('expert.user_id = :userId', { userId })
      .getOne();

    if (!expert) {
      // 프로필이 없으면 새로 생성 (Request Interceptor가 이미 변환)
      expert = this.expertsRepository.create({
        user_id: userId,
        user,
        ...updateDto,
      });
    } else {
      // Request Interceptor가 이미 변환했으므로 단순화
      const convertedData = { ...updateDto };
      
      Object.assign(expert, convertedData);
    }

    // 트랜잭션으로 프로필 저장과 일정 동기화 처리
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedExpert = await queryRunner.manager.save(expert);

      // available_hours가 변경된 경우 - schedules 테이블은 더이상 사용하지 않음 (통합 상담 시스템으로 마이그레이션 완료)
      if (updateDto.available_hours) {
        console.log('available_hours 업데이트 완료 - 통합 상담 시스템에서 동적으로 처리');
      }

      await queryRunner.commitTransaction();

      // 관련 캐시 무효화 (트랜잭션 성공 후)
      await this.cacheService.del(`expert:detail:${savedExpert.id}`);
      await this.cacheService.invalidateByTag('experts');

      return plainToClass(ExpertDetailResponseDto, savedExpert, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('프로필 업데이트 트랜잭션 실패:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validateAvailableHours(availableHours: any): void {
    if (!availableHours || typeof availableHours !== 'object') {
      throw new BadRequestException('availableHours는 유효한 객체여야 합니다.');
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const [day, timeSlots] of Object.entries(availableHours)) {
      if (!validDays.includes(day)) {
        throw new BadRequestException(`유효하지 않은 요일입니다: ${day}`);
      }

      if (!Array.isArray(timeSlots)) {
        throw new BadRequestException(`${day}의 시간 슬롯은 배열이어야 합니다.`);
      }

      for (const slot of timeSlots) {
        if (!slot.start || !slot.end) {
          throw new BadRequestException(`${day}의 시간 슬롯에 start 또는 end가 누락되었습니다.`);
        }

        const startTime = new Date(`1970-01-01T${slot.start}`);
        const endTime = new Date(`1970-01-01T${slot.end}`);
        
        if (startTime >= endTime) {
          throw new BadRequestException(`${day}의 종료 시간은 시작 시간보다 늦어야 합니다.`);
        }
      }
    }
  }

  private getSortField(sort: string): string {
    const sortMap = {
      name: 'user.name',
      experience: 'expert.years_experience',
      rate: 'expert.hourly_rate',
      created_at: 'expert.created_at',
    };

    return sortMap[sort] || 'expert.created_at';
  }
}