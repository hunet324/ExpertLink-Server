import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Center } from '../entities/center.entity';
import { User, UserType } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { CenterQueryDto } from './dto/center-query.dto';
import { CenterResponseDto, CenterListResponseDto } from './dto/center-response.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class CentersService {
  constructor(
    @InjectRepository(Center)
    private centerRepository: Repository<Center>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ExpertProfile)
    private expertProfileRepository: Repository<ExpertProfile>,
  ) {}

  async create(createDto: CreateCenterDto): Promise<CenterResponseDto> {
    // 센터 코드 중복 확인
    const existingCenter = await this.centerRepository.findOne({
      where: { code: createDto.code }
    });

    if (existingCenter) {
      throw new ConflictException('이미 존재하는 센터 코드입니다.');
    }

    // 센터장 유효성 확인
    if (createDto.managerId) {
      const manager = await this.userRepository.findOne({
        where: { 
          id: createDto.managerId,
          user_type: UserType.CENTER_MANAGER
        }
      });

      if (!manager) {
        throw new BadRequestException('유효하지 않은 센터장입니다.');
      }

      // 이미 다른 센터를 관리하고 있는지 확인
      const existingManagerCenter = await this.centerRepository.findOne({
        where: { manager_id: createDto.managerId }
      });

      if (existingManagerCenter) {
        throw new ConflictException('해당 사용자는 이미 다른 센터의 센터장입니다.');
      }
    }

    // 상위 센터 유효성 확인
    if (createDto.parentCenterId) {
      const parentCenter = await this.centerRepository.findOne({
        where: { id: createDto.parentCenterId }
      });

      if (!parentCenter) {
        throw new BadRequestException('유효하지 않은 상위 센터입니다.');
      }
    }

    const center = this.centerRepository.create({
      name: createDto.name,
      code: createDto.code,
      address: createDto.address,
      phone: createDto.phone,
      manager_id: createDto.managerId,
      parent_center_id: createDto.parentCenterId,
      is_active: createDto.is_active ?? createDto.isActive ?? true,
    });

    const savedCenter = await this.centerRepository.save(center);
    return await this.getCenterWithDetails(savedCenter.id);
  }

  async findAll(query: CenterQueryDto): Promise<CenterListResponseDto> {
    const queryBuilder = this.centerRepository
      .createQueryBuilder('center')
      .leftJoinAndSelect('center.manager', 'manager')
      .leftJoinAndSelect('center.parentCenter', 'parentCenter')
      .leftJoin('center.staff', 'staff')
      .leftJoin('center.experts', 'experts')
      .addSelect('COUNT(DISTINCT staff.id)', 'staff_count')
      .addSelect('COUNT(DISTINCT experts.id)', 'expert_count')
      .groupBy('center.id')
      .addGroupBy('manager.id')
      .addGroupBy('parentCenter.id');

    // 필터 적용
    this.applyFilters(queryBuilder, query);

    // 정렬 적용
    this.applySorting(queryBuilder, query);

    // 전체 개수 조회 (그룹화 후)
    const totalQuery = queryBuilder.clone();
    const totalResult = await totalQuery.getRawMany();
    const total = totalResult.length;

    // 페이지네이션 적용
    const result = await queryBuilder
      .offset(query.offset)
      .limit(query.limit)
      .getRawAndEntities();

    const centers = result.entities.map((center, index) => {
      const raw = result.raw[index];
      const centerDto = plainToClass(CenterResponseDto, {
        id: center.id,
        name: center.name,
        code: center.code,
        address: center.address,
        phone: center.phone,
        managerId: center.manager_id,
        managerName: center.manager?.name,
        parentCenterId: center.parent_center_id,
        parentCenterName: center.parentCenter?.name,
        isActive: center.is_active,
        staffCount: parseInt(raw.staff_count) || 0,
        expertCount: parseInt(raw.expert_count) || 0,
        createdAt: center.created_at,
        updatedAt: center.updated_at,
      }, { excludeExtraneousValues: true });

      return centerDto;
    });

    return {
      centers,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOne(id: number): Promise<CenterResponseDto> {
    return await this.getCenterWithDetails(id);
  }

  async update(id: number, updateDto: UpdateCenterDto): Promise<CenterResponseDto> {
    const center = await this.centerRepository.findOne({ where: { id } });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    // 센터 코드 중복 확인 (자신 제외)
    if (updateDto.code && updateDto.code !== center.code) {
      const existingCenter = await this.centerRepository.findOne({
        where: { code: updateDto.code }
      });

      if (existingCenter) {
        throw new ConflictException('이미 존재하는 센터 코드입니다.');
      }
    }

    // 센터장 유효성 확인
    if (updateDto.managerId) {
      const manager = await this.userRepository.findOne({
        where: { 
          id: updateDto.managerId,
          user_type: UserType.CENTER_MANAGER
        }
      });

      if (!manager) {
        throw new BadRequestException('유효하지 않은 센터장입니다.');
      }

      // 이미 다른 센터를 관리하고 있는지 확인 (현재 센터 제외)
      const existingManagerCenter = await this.centerRepository
        .createQueryBuilder('center')
        .where('center.manager_id = :managerId', { managerId: updateDto.managerId })
        .andWhere('center.id != :id', { id })
        .getOne();

      if (existingManagerCenter) {
        throw new ConflictException('해당 사용자는 이미 다른 센터의 센터장입니다.');
      }
    }

    // 상위 센터 유효성 확인
    if (updateDto.parentCenterId) {
      const parentCenter = await this.centerRepository.findOne({
        where: { id: updateDto.parentCenterId }
      });

      if (!parentCenter) {
        throw new BadRequestException('유효하지 않은 상위 센터입니다.');
      }

      // 순환 참조 방지
      if (updateDto.parentCenterId === id) {
        throw new BadRequestException('자기 자신을 상위 센터로 설정할 수 없습니다.');
      }
    }

    // 업데이트 적용
    Object.assign(center, {
      name: updateDto.name ?? center.name,
      code: updateDto.code ?? center.code,
      address: updateDto.address ?? center.address,
      phone: updateDto.phone ?? center.phone,
      manager_id: updateDto.managerId ?? center.manager_id,
      parent_center_id: updateDto.parentCenterId ?? center.parent_center_id,
      is_active: updateDto.isActive ?? center.is_active,
    });

    await this.centerRepository.save(center);
    return await this.getCenterWithDetails(id);
  }

  async remove(id: number): Promise<void> {
    const center = await this.centerRepository.findOne({
      where: { id },
      relations: ['subCenters', 'staff', 'experts']
    });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    // 하위 센터가 있는지 확인
    if (center.subCenters && center.subCenters.length > 0) {
      throw new BadRequestException('하위 센터가 있는 센터는 삭제할 수 없습니다.');
    }

    // 소속 직원이 있는지 확인
    if (center.staff && center.staff.length > 0) {
      throw new BadRequestException('소속 직원이 있는 센터는 삭제할 수 없습니다.');
    }

    // 소속 전문가가 있는지 확인
    if (center.experts && center.experts.length > 0) {
      throw new BadRequestException('소속 전문가가 있는 센터는 삭제할 수 없습니다.');
    }

    await this.centerRepository.remove(center);
  }

  private async getCenterWithDetails(id: number): Promise<CenterResponseDto> {
    const center = await this.centerRepository
      .createQueryBuilder('center')
      .leftJoinAndSelect('center.manager', 'manager')
      .leftJoinAndSelect('center.parentCenter', 'parentCenter')
      .leftJoin('center.staff', 'staff')
      .leftJoin('center.experts', 'experts')
      .addSelect('COUNT(DISTINCT staff.id)', 'staff_count')
      .addSelect('COUNT(DISTINCT experts.id)', 'expert_count')
      .where('center.id = :id', { id })
      .groupBy('center.id')
      .addGroupBy('manager.id')
      .addGroupBy('parentCenter.id')
      .getRawAndEntities();

    if (!center.entities.length) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    const centerEntity = center.entities[0];
    const raw = center.raw[0];

    return plainToClass(CenterResponseDto, {
      id: centerEntity.id,
      name: centerEntity.name,
      code: centerEntity.code,
      address: centerEntity.address,
      phone: centerEntity.phone,
      managerId: centerEntity.manager_id,
      managerName: centerEntity.manager?.name,
      parentCenterId: centerEntity.parent_center_id,
      parentCenterName: centerEntity.parentCenter?.name,
      isActive: centerEntity.is_active,
      staffCount: parseInt(raw.staff_count) || 0,
      expertCount: parseInt(raw.expert_count) || 0,
      createdAt: centerEntity.created_at,
      updatedAt: centerEntity.updated_at,
    }, { excludeExtraneousValues: true });
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Center>, query: CenterQueryDto) {
    if (query.search) {
      queryBuilder.andWhere(
        '(center.name ILIKE :search OR center.code ILIKE :search OR center.address ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    if (query.parentCenterId !== undefined) {
      queryBuilder.andWhere('center.parent_center_id = :parentCenterId', {
        parentCenterId: query.parentCenterId
      });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('center.is_active = :isActive', {
        isActive: query.isActive
      });
    }
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Center>, query: CenterQueryDto) {
    const sortMap = {
      name: 'center.name',
      code: 'center.code',
      created_at: 'center.created_at',
    };

    const sortField = sortMap[query.sortBy] || 'center.created_at';
    queryBuilder.orderBy(sortField, query.sortOrder);
  }

  /**
   * 센터 코드 중복 검사
   */
  async checkCenterCode(code: string): Promise<{ available: boolean; message?: string }> {
    if (!code || typeof code !== 'string') {
      return { available: false, message: '센터 코드를 입력해주세요.' };
    }

    // 코드 형식 검증
    if (!/^[A-Z]{2,4}[0-9]{3,4}$/.test(code)) {
      return { 
        available: false, 
        message: '센터 코드는 영문 대문자 2-4자 + 숫자 3-4자 형식이어야 합니다.' 
      };
    }

    // 중복 확인
    const existingCenter = await this.centerRepository.findOne({
      where: { code: code.toUpperCase() }
    });

    if (existingCenter) {
      return { 
        available: false, 
        message: '이미 사용 중인 센터 코드입니다.' 
      };
    }

    return { 
      available: true, 
      message: '사용 가능한 센터 코드입니다.' 
    };
  }

  /**
   * 센터 직원 목록 조회
   */
  async getCenterStaff(centerId: number): Promise<any[]> {
    const center = await this.centerRepository.findOne({
      where: { id: centerId }
    });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    const staff = await this.userRepository.find({
      where: { 
        center_id: centerId,
        user_type: UserType.STAFF  // 직원만 조회
      },
      select: [
        'id', 'name', 'email', 'user_type', 'center_id', 
        'supervisor_id', 'created_at', 'updated_at'
      ],
      order: { created_at: 'DESC' }
    });

    return staff.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.user_type,
      centerId: user.center_id,
      supervisorId: user.supervisor_id,
      createdAt: user.created_at
    }));
  }

  /**
   * 센터 전문가 목록 조회
   */
  async getCenterExperts(centerId: number): Promise<any[]> {
    const center = await this.centerRepository.findOne({
      where: { id: centerId }
    });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    // 전문가 사용자들을 먼저 조회 (ExpertProfile 유무와 관계없이)
    const experts = await this.userRepository.find({
      where: { 
        center_id: centerId,
        user_type: UserType.EXPERT
      },
      relations: ['expertProfile'],
      order: { created_at: 'DESC' }
    });

    return experts.map(expert => ({
      id: expert.id,
      name: expert.name,
      email: expert.email,
      specialties: expert.expertProfile?.specialization || [],
      status: expert.status,
      centerId: expert.center_id,
      isVerified: expert.expertProfile?.is_verified || false,
      yearsExperience: expert.expertProfile?.years_experience || 0,
      hourlyRate: expert.expertProfile?.hourly_rate || 0,
      licenseType: expert.expertProfile?.license_type || '',
      licenseNumber: expert.expertProfile?.license_number || '',
      createdAt: expert.created_at
    }));
  }

  /**
   * 센터 통계 조회
   */
  async getCenterStatistics(centerId: number): Promise<any> {
    const center = await this.centerRepository.findOne({
      where: { id: centerId },
      relations: ['manager', 'parentCenter']
    });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    // 기본 통계
    const staffCount = await this.userRepository.count({
      where: { center_id: centerId, user_type: UserType.STAFF }
    });

    const managerCount = await this.userRepository.count({
      where: { center_id: centerId, user_type: UserType.CENTER_MANAGER }
    });

    // 이번 달 통계
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    return {
      center: {
        id: center.id,
        name: center.name,
        code: center.code,
        manager: center.manager ? {
          id: center.manager.id,
          name: center.manager.name
        } : null,
        isActive: center.is_active
      },
      overview: {
        totalStaff: staffCount,
        totalManagers: managerCount,
        totalMembers: staffCount + managerCount
      },
      period: {
        month: currentMonth.getMonth() + 1,
        year: currentMonth.getFullYear(),
        startDate: monthStart,
        endDate: monthEnd
      }
    };
  }

  /**
   * 센터에 직원 배정
   */
  async assignStaffToCenter(centerId: number, userId: number): Promise<any> {
    // 센터 존재 확인
    const center = await this.centerRepository.findOne({
      where: { id: centerId }
    });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    // 사용자 존재 확인
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 사용자가 이미 다른 센터에 배정되어 있는지 확인
    if (user.center_id && user.center_id !== centerId) {
      throw new ConflictException('이미 다른 센터에 배정된 사용자입니다.');
    }

    // 사용자가 이미 이 센터의 직원인지 확인
    if (user.center_id === centerId && user.user_type === UserType.STAFF) {
      throw new ConflictException('이미 이 센터의 직원으로 배정된 사용자입니다.');
    }

    // 사용자 정보 업데이트
    await this.userRepository.update(userId, {
      center_id: centerId,
      user_type: UserType.STAFF
    });

    // 업데이트된 사용자 정보 조회
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId }
    });

    return {
      success: true,
      message: '직원이 성공적으로 배정되었습니다.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType: updatedUser.user_type,
        centerId: updatedUser.center_id
      }
    };
  }

  /**
   * 센터에서 직원 배정 해제
   */
  async removeStaffFromCenter(centerId: number, userId: number): Promise<any> {
    // 센터 존재 확인
    const center = await this.centerRepository.findOne({
      where: { id: centerId }
    });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    // 사용자 존재 확인
    const user = await this.userRepository.findOne({
      where: { id: userId, center_id: centerId }
    });

    if (!user) {
      throw new NotFoundException('해당 센터에 배정된 사용자를 찾을 수 없습니다.');
    }

    // 센터장은 배정 해제할 수 없음
    if (center.manager_id === userId) {
      throw new BadRequestException('센터장은 배정을 해제할 수 없습니다.');
    }

    // 사용자 정보 업데이트 (일반 사용자로 변경)
    await this.userRepository.update(userId, {
      center_id: null,
      user_type: UserType.GENERAL,
      supervisor_id: null
    });

    return {
      success: true,
      message: '직원 배정이 해제되었습니다.'
    };
  }

  /**
   * 센터에 전문가 배정
   */
  async assignExpertToCenter(centerId: number, userId: number): Promise<any> {
    try {
      // 센터 존재 확인
      const center = await this.centerRepository.findOne({
        where: { id: centerId }
      });

      if (!center) {
        throw new NotFoundException('센터를 찾을 수 없습니다.');
      }

      // 사용자 존재 확인
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 사용자가 이미 다른 센터에 배정되어 있는지 확인
      if (user.center_id && user.center_id !== centerId) {
        throw new ConflictException('이미 다른 센터에 배정된 사용자입니다.');
      }

      // 사용자가 이미 이 센터의 전문가인지 확인
      if (user.center_id === centerId && user.user_type === UserType.EXPERT) {
        throw new ConflictException('이미 이 센터의 전문가로 배정된 사용자입니다.');
      }

      // ExpertProfile이 있는지 확인하고 없으면 생성
      let expertProfile = await this.expertProfileRepository.findOne({
        where: { user: { id: userId } }
      });

      if (!expertProfile) {
        // ExpertProfile 생성
        expertProfile = this.expertProfileRepository.create({
          user: { id: userId },
          specialization: [],
          years_experience: 0,
          is_verified: false,
          license_type: '',
          license_number: '',
          hourly_rate: 0
        });
        await this.expertProfileRepository.save(expertProfile);
      }

      // 사용자 정보 업데이트 (전문가 타입으로 변경)
      await this.userRepository.update(userId, {
        center_id: centerId,
        user_type: UserType.EXPERT
      });

      // 업데이트된 사용자 정보 조회
      const updatedUser = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!updatedUser) {
        throw new NotFoundException('업데이트된 사용자 정보를 찾을 수 없습니다.');
      }

      return {
        success: true,
        message: '전문가가 성공적으로 배정되었습니다.',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          userType: updatedUser.user_type,
          centerId: updatedUser.center_id
        }
      };
    } catch (error) {
      const { LoggerUtil } = await import('../common/utils/logger.util');
      LoggerUtil.error('Expert assignment error', error);
      throw error;
    }
  }

  /**
   * 센터에서 전문가 배정 해제
   */
  async removeExpertFromCenter(centerId: number, userId: number): Promise<any> {
    // 센터 존재 확인
    const center = await this.centerRepository.findOne({
      where: { id: centerId }
    });

    if (!center) {
      throw new NotFoundException('센터를 찾을 수 없습니다.');
    }

    // 사용자 존재 확인
    const user = await this.userRepository.findOne({
      where: { id: userId, center_id: centerId }
    });

    if (!user) {
      throw new NotFoundException('해당 센터에 배정된 전문가를 찾을 수 없습니다.');
    }

    // 사용자 정보 업데이트 (일반 사용자로 변경)
    await this.userRepository.update(userId, {
      center_id: null,
      user_type: UserType.GENERAL,
      supervisor_id: null
    });

    return {
      success: true,
      message: '전문가 배정이 해제되었습니다.'
    };
  }
}