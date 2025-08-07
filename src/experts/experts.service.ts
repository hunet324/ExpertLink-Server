import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { User, UserType, UserStatus } from '../entities/user.entity';
import { ExpertSearchDto } from './dto/expert-search.dto';
import { ExpertListResponseDto, ExpertDetailResponseDto } from './dto/expert-response.dto';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ExpertsService {
  constructor(
    @InjectRepository(ExpertProfile)
    private expertsRepository: Repository<ExpertProfile>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async searchExperts(searchDto: ExpertSearchDto): Promise<{ experts: ExpertListResponseDto[]; total: number; page: number; totalPages: number }> {
    const { search, specialization, min_experience, max_hourly_rate, page = 1, limit = 10, sort = 'created_at', order = 'DESC' } = searchDto;

    const query = this.expertsRepository
      .createQueryBuilder('expert')
      .leftJoinAndSelect('expert.user', 'user')
      .where('user.user_type = :userType', { userType: UserType.EXPERT })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE });

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
  }

  async getExpertDetail(id: number): Promise<ExpertDetailResponseDto> {
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
      .leftJoinAndSelect('expert.user', 'user')
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
      });
      await this.expertsRepository.save(expert);
    }

    return plainToClass(ExpertDetailResponseDto, expert, {
      excludeExtraneousValues: true,
    });
  }

  async updateExpertProfile(userId: number, updateDto: UpdateExpertProfileDto): Promise<ExpertDetailResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user || user.user_type !== UserType.EXPERT) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    let expert = await this.expertsRepository
      .createQueryBuilder('expert')
      .leftJoinAndSelect('expert.user', 'user')
      .where('expert.user_id = :userId', { userId })
      .getOne();

    if (!expert) {
      // 프로필이 없으면 새로 생성
      expert = this.expertsRepository.create({
        user_id: userId,
        user,
        ...updateDto,
      });
    } else {
      // 기존 프로필 업데이트
      Object.assign(expert, updateDto);
    }

    const savedExpert = await this.expertsRepository.save(expert);

    return plainToClass(ExpertDetailResponseDto, savedExpert, {
      excludeExtraneousValues: true,
    });
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