import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { User, UserType } from '../entities/user.entity';
import { Center } from '../entities/center.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
// import { Schedule, ScheduleStatus } from '../entities/schedule.entity'; // Removed - schedules migrated to counselings
import { ExpertVacation, VacationStatus, VacationType } from '../entities/expert-vacation.entity';
import { WorkLog, WorkStatus } from '../entities/work-log.entity';
import { QueryScopeUtil, ScopeUser } from '../common/utils/query-scope.util';

@Injectable()
export class AdminScopedServiceExample {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Center)
    private centerRepository: Repository<Center>,
    @InjectRepository(ExpertProfile)
    private expertRepository: Repository<ExpertProfile>,
    // @InjectRepository(Schedule) // Removed - schedules migrated to counselings
    // private scheduleRepository: Repository<Schedule>,
    @InjectRepository(ExpertVacation)
    private expertVacationRepository: Repository<ExpertVacation>,
    @InjectRepository(WorkLog)
    private workLogRepository: Repository<WorkLog>,
  ) {}

  /**
   * 권한에 따른 센터 목록 조회
   */
  async getCentersWithScope(user: ScopeUser): Promise<Center[]> {
    const queryBuilder = this.centerRepository
      .createQueryBuilder('center')
      .leftJoinAndSelect('center.manager', 'manager')
      .leftJoinAndSelect('center.parentCenter', 'parentCenter');

    // 사용자 권한에 따른 범위 적용
    QueryScopeUtil.applyCenterScope(queryBuilder, user, 'center');

    return await queryBuilder.getMany();
  }

  /**
   * 권한에 따른 직원 목록 조회
   */
  async getStaffWithScope(user: ScopeUser, centerId?: number): Promise<User[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.center', 'center')
      .where('user.user_type IN (:...staffTypes)', {
        staffTypes: [UserType.STAFF, UserType.CENTER_MANAGER, UserType.REGIONAL_MANAGER]
      });

    // 특정 센터 지정 시
    if (centerId) {
      // 해당 센터에 접근 권한 확인
      const canAccess = await QueryScopeUtil.canAccessCenter(this.centerRepository, user, centerId);
      if (!canAccess) {
        throw new ForbiddenException('해당 센터에 접근할 권한이 없습니다.');
      }
      queryBuilder.andWhere('user.center_id = :centerId', { centerId });
    } else {
      // 전체 조회 시 권한에 따른 범위 적용
      QueryScopeUtil.applyUserScope(queryBuilder, user, 'user');
    }

    return await queryBuilder.getMany();
  }

  /**
   * 권한에 따른 전문가 목록 조회
   */
  async getExpertsWithScope(user: ScopeUser, centerId?: number): Promise<ExpertProfile[]> {
    const queryBuilder = this.expertRepository
      .createQueryBuilder('expert')
      .leftJoinAndSelect('expert.user', 'user')
      .leftJoinAndSelect('expert.center', 'center');

    // 특정 센터 지정 시
    if (centerId) {
      const canAccess = await QueryScopeUtil.canAccessCenter(this.centerRepository, user, centerId);
      if (!canAccess) {
        throw new ForbiddenException('해당 센터에 접근할 권한이 없습니다.');
      }
      queryBuilder.andWhere('expert.center_id = :centerId', { centerId });
    } else {
      // 전체 조회 시 권한에 따른 범위 적용
      QueryScopeUtil.applyExpertScope(queryBuilder, user, 'expert');
    }

    return await queryBuilder.getMany();
  }

  /**
   * 센터장의 소속 전문가 휴가 관리
   */
  async manageExpertVacation(
    user: ScopeUser,
    expertId: number,
    vacationData: {
      startDate: Date;
      endDate: Date;
      reason: string;
      vacationType?: string;
    }
  ): Promise<any> {
    // 센터장 이상만 전문가 휴가 관리 가능
    if (![UserType.CENTER_MANAGER, UserType.REGIONAL_MANAGER, UserType.SUPER_ADMIN].includes(user.user_type)) {
      throw new ForbiddenException('전문가 휴가 관리 권한이 없습니다.');
    }

    const expert = await this.expertRepository.findOne({
      where: { id: expertId },
      relations: ['user', 'center']
    });

    if (!expert) {
      throw new ForbiddenException('전문가를 찾을 수 없습니다.');
    }

    // 권한 확인
    const canManage = await this.canManageExpert(user, expert);
    if (!canManage) {
      throw new ForbiddenException('해당 전문가를 관리할 권한이 없습니다.');
    }

    // 휴가 기간 동안 기존 상담 확인 (통합 상담 시스템 사용)
    // TODO: CounselingsService를 통해 휴가 기간 중 예약된 상담 확인
    // const existingCounselings = await this.counselingsService.getExpertCounselingsInPeriod(
    //   expertId, vacationData.startDate, vacationData.endDate
    // );
    
    // 현재는 경고 없이 진행 (추후 통합 상담 시스템과 연동 필요)
    console.log('휴가 설정 - 통합 상담 시스템과의 연동은 추후 구현 예정');

    // 휴가 신청 생성
    const vacation = this.expertVacationRepository.create({
      expert_id: expertId,
      approved_by: user.id,
      start_date: vacationData.startDate,
      end_date: vacationData.endDate,
      vacation_type: (vacationData.vacationType as VacationType) || VacationType.ANNUAL,
      reason: vacationData.reason,
      status: VacationStatus.APPROVED, // 센터장이 직접 설정하므로 바로 승인
      approved_at: new Date()
    });

    const savedVacation = await this.expertVacationRepository.save(vacation);

    // 휴가 기간 동안의 가능한 슬롯 취소 (통합 상담 시스템에서 처리)
    // TODO: CounselingsService를 통해 휴가 기간의 가용 슬롯 비활성화
    // await this.counselingsService.cancelAvailableSlotsInPeriod(
    //   expertId, vacationData.startDate, vacationData.endDate, `휴가로 인한 취소 - ${vacationData.reason}`
    // );
    
    console.log('휴가 기간 슬롯 취소 - 통합 상담 시스템과의 연동은 추후 구현 예정');

    return {
      vacation: savedVacation,
      cancelledSchedules: 0, // 통합 상담 시스템과 연동 후 실제 값으로 업데이트
      message: '전문가 휴가가 성공적으로 설정되었습니다.'
    };
  }

  /**
   * 센터장의 소속 전문가 근무시간 모니터링
   */
  async getExpertWorkingHours(
    user: ScopeUser,
    expertId: number,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // 센터장 이상만 접근 가능
    if (![UserType.CENTER_MANAGER, UserType.REGIONAL_MANAGER, UserType.SUPER_ADMIN].includes(user.user_type)) {
      throw new ForbiddenException('전문가 근무시간 조회 권한이 없습니다.');
    }

    const expert = await this.expertRepository.findOne({
      where: { id: expertId },
      relations: ['user', 'center']
    });

    if (!expert) {
      throw new ForbiddenException('전문가를 찾을 수 없습니다.');
    }

    const canManage = await this.canManageExpert(user, expert);
    if (!canManage) {
      throw new ForbiddenException('해당 전문가의 근무시간을 조회할 권한이 없습니다.');
    }

    // 근무 로그 조회
    const workLogs = await this.workLogRepository.find({
      where: {
        expert_id: expertId,
        work_date: Between(startDate, endDate)
      },
      order: { work_date: 'ASC', logged_at: 'ASC' }
    });

    // 일별 근무시간 계산
    const dailyWorkHours = new Map<string, any>();
    
    for (const log of workLogs) {
      const dateKey = log.work_date.toISOString().split('T')[0];
      
      if (!dailyWorkHours.has(dateKey)) {
        dailyWorkHours.set(dateKey, {
          date: dateKey,
          logs: [],
          startTime: null,
          endTime: null,
          totalHours: 0,
          breakTime: 0
        });
      }

      const dayData = dailyWorkHours.get(dateKey);
      dayData.logs.push({
        status: log.status,
        time: log.logged_at.toTimeString().slice(0, 5),
        notes: log.notes
      });

      // 출근 시간
      if (log.status === WorkStatus.STARTED && !dayData.startTime) {
        dayData.startTime = log.logged_at.toTimeString().slice(0, 5);
      }

      // 퇴근 시간
      if (log.status === WorkStatus.FINISHED) {
        dayData.endTime = log.logged_at.toTimeString().slice(0, 5);
      }
    }

    // 근무시간 계산
    const workingHours = Array.from(dailyWorkHours.values()).map(day => {
      if (day.startTime && day.endTime) {
        const start = new Date(`1970-01-01T${day.startTime}:00`);
        const end = new Date(`1970-01-01T${day.endTime}:00`);
        const diffMs = end.getTime() - start.getTime();
        day.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }
      return day;
    });

    const totalHours = workingHours.reduce((sum, day) => sum + day.totalHours, 0);
    const totalWorkingDays = workingHours.filter(day => day.totalHours > 0).length;

    // 휴가 정보도 함께 조회
    const vacations = await this.expertVacationRepository.find({
      where: {
        expert_id: expertId,
        start_date: LessThanOrEqual(endDate),
        end_date: MoreThanOrEqual(startDate),
        status: VacationStatus.APPROVED
      }
    });

    return {
      expertId,
      expertName: expert.user.name,
      period: { startDate, endDate },
      workingHours,
      totalWorkingDays,
      totalHours: Math.round(totalHours * 100) / 100,
      averageHoursPerDay: totalWorkingDays > 0 ? Math.round((totalHours / totalWorkingDays) * 100) / 100 : 0,
      vacations: vacations.map(v => ({
        startDate: v.start_date,
        endDate: v.end_date,
        type: v.vacation_type,
        reason: v.reason
      }))
    };
  }

  /**
   * 직원 관리 권한 확인
   */
  async canManageStaff(manager: ScopeUser, targetUserId: number): Promise<boolean> {
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      select: ['id', 'user_type', 'center_id']
    });

    if (!targetUser) {
      return false;
    }

    return QueryScopeUtil.canManageUser(manager, targetUser);
  }

  /**
   * 전문가 관리 권한 확인
   */
  private async canManageExpert(user: ScopeUser, expert: ExpertProfile): Promise<boolean> {
    // 최고 관리자는 모든 전문가 관리 가능
    if (user.user_type === UserType.SUPER_ADMIN) {
      return true;
    }

    // 지역 관리자는 담당 지역의 전문가만 관리 가능
    if (user.user_type === UserType.REGIONAL_MANAGER) {
      if (!user.center_id || !expert.center_id) {
        return false;
      }

      const managedCenterIds = await QueryScopeUtil.getManagedCenterIds(this.centerRepository, user);
      return managedCenterIds.includes(expert.center_id);
    }

    // 센터장은 자신의 센터 전문가만 관리 가능
    if (user.user_type === UserType.CENTER_MANAGER) {
      return user.center_id === expert.center_id;
    }

    return false;
  }

  /**
   * 관리 가능한 센터 통계
   */
  async getCenterStatistics(user: ScopeUser): Promise<any> {
    const managedCenterIds = await QueryScopeUtil.getManagedCenterIds(this.centerRepository, user);

    if (managedCenterIds.length === 0) {
      return {
        totalCenters: 0,
        totalStaff: 0,
        totalExperts: 0,
        centers: []
      };
    }

    // 센터별 통계 조회
    const centerStats = await Promise.all(
      managedCenterIds.map(async (centerId) => {
        const staffCount = await this.userRepository.count({
          where: {
            center_id: centerId,
            user_type: UserType.STAFF
          }
        });

        const expertCount = await this.expertRepository.count({
          where: { center_id: centerId }
        });

        const center = await this.centerRepository.findOne({
          where: { id: centerId },
          select: ['id', 'name', 'code']
        });

        return {
          center,
          staffCount,
          expertCount
        };
      })
    );

    const totalStaff = centerStats.reduce((sum, stat) => sum + stat.staffCount, 0);
    const totalExperts = centerStats.reduce((sum, stat) => sum + stat.expertCount, 0);

    return {
      totalCenters: managedCenterIds.length,
      totalStaff,
      totalExperts,
      centers: centerStats
    };
  }
}