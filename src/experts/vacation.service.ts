import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ExpertVacation, VacationStatus } from '../entities/expert-vacation.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { User } from '../entities/user.entity';
import { CreateVacationDto, UpdateVacationStatusDto, VacationQueryDto, VacationResponseDto, VacationListResponseDto } from './dto/vacation.dto';
import { LoggerUtil } from '../common/utils/logger.util';

@Injectable()
export class VacationService {
  constructor(
    @InjectRepository(ExpertVacation)
    private vacationRepository: Repository<ExpertVacation>,
    @InjectRepository(ExpertProfile)
    private expertProfileRepository: Repository<ExpertProfile>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createVacation(createVacationDto: CreateVacationDto, requestUserId: number): Promise<VacationResponseDto> {
    LoggerUtil.log('INFO', 'Creating vacation request', { createVacationDto, requestUserId });

    // 전문가 프로필 확인
    const expertProfile = await this.expertProfileRepository.findOne({
      where: { user_id: createVacationDto.expert_id },
      relations: ['user']
    });

    if (!expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    // 날짜 유효성 검사
    const startDate = new Date(createVacationDto.start_date);
    const endDate = new Date(createVacationDto.end_date);
    
    if (endDate < startDate) {
      throw new BadRequestException('종료일은 시작일보다 늦어야 합니다.');
    }

    if (startDate < new Date()) {
      throw new BadRequestException('과거 날짜로 휴가를 신청할 수 없습니다.');
    }

    // 겹치는 휴가 확인
    const overlappingVacation = await this.vacationRepository.findOne({
      where: {
        expert_id: createVacationDto.expert_id,
        status: VacationStatus.APPROVED,
        start_date: Between(startDate, endDate)
      }
    });

    if (overlappingVacation) {
      throw new BadRequestException('해당 기간에 이미 승인된 휴가가 있습니다.');
    }

    // 휴가 신청 생성
    const vacation = this.vacationRepository.create({
      ...createVacationDto,
      start_date: startDate,
      end_date: endDate,
    });

    const savedVacation = await this.vacationRepository.save(vacation);
    
    LoggerUtil.log('INFO', 'Vacation request created successfully', { vacationId: savedVacation.id });
    
    return this.mapToResponseDto(savedVacation, expertProfile.user);
  }

  async getVacations(queryDto: VacationQueryDto, currentUser?: any): Promise<VacationListResponseDto> {
    LoggerUtil.log('INFO', 'Fetching vacations', { queryDto, userId: currentUser?.id });

    const { expert_id, status, vacation_type, start_date, end_date, page, limit } = queryDto;
    
    const queryBuilder = this.vacationRepository.createQueryBuilder('vacation')
      .leftJoinAndSelect('vacation.expert', 'expert')
      .leftJoinAndSelect('expert.user', 'expertUser')
      .leftJoinAndSelect('vacation.approver', 'approver')
      .orderBy('vacation.created_at', 'DESC');

    // 센터 범위 검증 (center_manager인 경우에만 적용)
    if (currentUser?.userType === 'center_manager' && currentUser?.centerId) {
      queryBuilder.andWhere('expert.center_id = :centerId', { centerId: currentUser.centerId });
      LoggerUtil.log('INFO', 'Applied center scope filter', { 
        centerId: currentUser.centerId, 
        userType: currentUser.userType 
      });
    }

    // 필터 적용
    if (expert_id) {
      queryBuilder.andWhere('vacation.expert_id = :expert_id', { expert_id });
    }

    if (status) {
      queryBuilder.andWhere('vacation.status = :status', { status });
    }

    if (vacation_type) {
      queryBuilder.andWhere('vacation.vacation_type = :vacation_type', { vacation_type });
    }

    if (start_date && end_date) {
      queryBuilder.andWhere('vacation.start_date BETWEEN :start_date AND :end_date', {
        start_date: new Date(start_date),
        end_date: new Date(end_date)
      });
    }

    // 페이지네이션
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [vacations, total] = await queryBuilder.getManyAndCount();

    const vacationDtos = vacations.map(vacation => this.mapToResponseDto(vacation));

    return {
      vacations: vacationDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getVacationById(id: number, currentUser?: any): Promise<VacationResponseDto> {
    LoggerUtil.log('INFO', 'Fetching vacation by ID', { id, userId: currentUser?.id });

    const vacation = await this.vacationRepository.findOne({
      where: { id },
      relations: ['expert', 'expert.user', 'approver']
    });

    if (!vacation) {
      throw new NotFoundException('휴가 신청을 찾을 수 없습니다.');
    }

    // 센터 범위 검증
    if (currentUser?.userType === 'center_manager' && currentUser?.centerId) {
      if (vacation.expert?.center_id !== currentUser.centerId) {
        LoggerUtil.error('Center scope violation - vacation access denied', {
          userId: currentUser.id,
          userCenterId: currentUser.centerId,
          expertCenterId: vacation.expert?.center_id,
          vacationId: id
        });
        throw new ForbiddenException('다른 센터의 휴가 신청에 접근할 수 없습니다.');
      }
    }

    return this.mapToResponseDto(vacation);
  }

  async updateVacationStatus(
    id: number, 
    updateStatusDto: UpdateVacationStatusDto, 
    approverId: number,
    currentUser?: any
  ): Promise<VacationResponseDto> {
    LoggerUtil.log('INFO', 'Updating vacation status', { id, updateStatusDto, approverId, userId: currentUser?.id });

    const vacation = await this.vacationRepository.findOne({
      where: { id },
      relations: ['expert', 'expert.user']
    });

    if (!vacation) {
      throw new NotFoundException('휴가 신청을 찾을 수 없습니다.');
    }

    // 센터 범위 검증
    if (currentUser?.userType === 'center_manager' && currentUser?.centerId) {
      if (vacation.expert?.center_id !== currentUser.centerId) {
        LoggerUtil.error('Center scope violation - vacation status update denied', {
          userId: currentUser.id,
          userCenterId: currentUser.centerId,
          expertCenterId: vacation.expert?.center_id,
          vacationId: id
        });
        throw new ForbiddenException('다른 센터의 휴가 상태를 변경할 수 없습니다.');
      }
    }

    if (vacation.status !== VacationStatus.PENDING) {
      throw new BadRequestException('이미 처리된 휴가 신청입니다.');
    }

    // 거부 시 사유 필수
    if (updateStatusDto.status === VacationStatus.REJECTED && !updateStatusDto.rejection_reason) {
      throw new BadRequestException('휴가 거부 시 사유는 필수입니다.');
    }

    // 승인자 정보 확인
    const approver = await this.userRepository.findOne({ where: { id: approverId } });
    if (!approver) {
      throw new NotFoundException('승인자 정보를 찾을 수 없습니다.');
    }

    // 상태 업데이트
    vacation.status = updateStatusDto.status;
    vacation.approved_by = approverId;
    vacation.approved_at = new Date();
    
    if (updateStatusDto.rejection_reason) {
      vacation.rejection_reason = updateStatusDto.rejection_reason;
    }

    const updatedVacation = await this.vacationRepository.save(vacation);
    
    LoggerUtil.log('INFO', 'Vacation status updated successfully', { 
      vacationId: id, 
      newStatus: updateStatusDto.status,
      approverId 
    });

    return this.mapToResponseDto(updatedVacation, vacation.expert?.user, approver);
  }

  async deleteVacation(id: number, requestUserId: number): Promise<void> {
    LoggerUtil.log('INFO', 'Deleting vacation', { id, requestUserId });

    const vacation = await this.vacationRepository.findOne({
      where: { id },
      relations: ['expert']
    });

    if (!vacation) {
      throw new NotFoundException('휴가 신청을 찾을 수 없습니다.');
    }

    // 본인 또는 관리자만 삭제 가능
    if (vacation.expert_id !== requestUserId) {
      const user = await this.userRepository.findOne({ where: { id: requestUserId } });
      if (!user || !['super_admin', 'center_manager'].includes(user.user_type)) {
        throw new ForbiddenException('휴가 신청을 삭제할 권한이 없습니다.');
      }
    }

    // 승인된 휴가는 삭제 불가
    if (vacation.status === VacationStatus.APPROVED) {
      throw new BadRequestException('승인된 휴가는 삭제할 수 없습니다.');
    }

    await this.vacationRepository.remove(vacation);
    
    LoggerUtil.log('INFO', 'Vacation deleted successfully', { id });
  }

  async getVacationStats(expertId?: number): Promise<any> {
    LoggerUtil.log('INFO', 'Fetching vacation stats', { expertId });

    const queryBuilder = this.vacationRepository.createQueryBuilder('vacation');

    if (expertId) {
      queryBuilder.where('vacation.expert_id = :expertId', { expertId });
    }

    const [total, pending, approved, rejected] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.clone().andWhere('vacation.status = :status', { status: VacationStatus.PENDING }).getCount(),
      queryBuilder.clone().andWhere('vacation.status = :status', { status: VacationStatus.APPROVED }).getCount(),
      queryBuilder.clone().andWhere('vacation.status = :status', { status: VacationStatus.REJECTED }).getCount(),
    ]);

    return {
      total,
      pending,
      approved,
      rejected
    };
  }

  private mapToResponseDto(
    vacation: ExpertVacation, 
    expert?: User, 
    approver?: User
  ): VacationResponseDto {
    return {
      id: vacation.id,
      expert_id: vacation.expert_id,
      expert_name: expert?.name || vacation.expert?.user?.name || '',
      expert_email: expert?.email || vacation.expert?.user?.email || '',
      approved_by: vacation.approved_by,
      approver_name: approver?.name || vacation.approver?.name || '',
      start_date: this.formatDate(vacation.start_date),
      end_date: this.formatDate(vacation.end_date),
      vacation_type: vacation.vacation_type,
      status: vacation.status,
      reason: vacation.reason,
      rejection_reason: vacation.rejection_reason || '',
      approved_at: this.formatDateTime(vacation.approved_at),
      created_at: this.formatDateTime(vacation.created_at),
      updated_at: this.formatDateTime(vacation.updated_at),
    };
  }

  private formatDate(date: any): string {
    if (!date) return '';
    
    // 이미 문자열인 경우 (YYYY-MM-DD 형태로 저장된 경우)
    if (typeof date === 'string') {
      // ISO 날짜 형태인지 확인하고 날짜 부분만 추출
      if (date.includes('T')) {
        return date.split('T')[0];
      }
      return date;
    }
    
    // Date 객체인 경우
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    
    // 다른 형태인 경우 Date로 변환 시도
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch (error) {
      LoggerUtil.error('날짜 포맷팅 오류', { date, error: error.message });
      return '';
    }
  }

  private formatDateTime(date: any): string {
    if (!date) return '';
    
    // 이미 문자열인 경우
    if (typeof date === 'string') {
      return date;
    }
    
    // Date 객체인 경우
    if (date instanceof Date) {
      return date.toISOString();
    }
    
    // 다른 형태인 경우 Date로 변환 시도
    try {
      return new Date(date).toISOString();
    } catch (error) {
      LoggerUtil.error('날짜시간 포맷팅 오류', { date, error: error.message });
      return '';
    }
  }
}