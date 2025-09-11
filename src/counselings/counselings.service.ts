import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not } from 'typeorm';
import { Counseling, CounselingStatus, CounselingType } from '../entities/counseling.entity';
import { User, UserType } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { CreateCounselingDto } from './dto/create-counseling.dto';
import { CreateAvailableSlotDto } from './dto/create-available-slot.dto';
import { BookSlotDto } from './dto/book-slot.dto';
import { UpdateCounselingStatusDto } from './dto/update-counseling-status.dto';
import { CounselingResponseDto } from './dto/counseling-response.dto';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { CounselingEventType, CounselingBookingRequestedEvent } from '../common/events/counseling.events';
import { plainToClass } from 'class-transformer';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class CounselingsService {
  constructor(
    @InjectRepository(Counseling)
    private counselingRepository: Repository<Counseling>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ExpertProfile)
    private expertProfileRepository: Repository<ExpertProfile>,
    private readonly rabbitmqService: RabbitMQService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // 가용 슬롯 생성 (전문가가 상담 가능한 시간대 등록)
  async createAvailableSlots(expertId: number, slots: CreateAvailableSlotDto[]): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({ 
      where: { id: expertId, user_type: UserType.EXPERT } 
    });
    if (!expert) {
      throw new NotFoundException('전문가를 찾을 수 없습니다.');
    }

    const counselings = slots.map(slot => ({
      expert_id: expertId,
      user_id: null, // NULL = 가용 슬롯
      schedule_date: slot.date,
      start_time: slot.startTime,
      end_time: slot.endTime,
      duration: slot.duration || 60,
      type: slot.type || CounselingType.VIDEO,
      status: CounselingStatus.AVAILABLE,
      title: slot.title || '상담 가능',
    }));
    
    return this.counselingRepository.save(counselings);
  }

  // 슬롯 예약 (사용자가 가용 슬롯 예약)
  async bookSlot(slotId: number, userId: number, bookingData: BookSlotDto): Promise<CounselingResponseDto> {
    const slot = await this.counselingRepository.findOne({
      where: { 
        id: slotId, 
        user_id: IsNull(), 
        status: CounselingStatus.AVAILABLE 
      },
      relations: ['expert', 'expertProfile']
    });
    
    if (!slot) {
      throw new NotFoundException('예약 가능한 슬롯을 찾을 수 없습니다.');
    }

    // 과거 날짜 확인
    const scheduleDateTime = new Date(`${slot.schedule_date}T${slot.start_time}`);
    if (scheduleDateTime < new Date()) {
      throw new BadRequestException('과거 일정에는 예약할 수 없습니다.');
    }
    
    // 슬롯을 예약으로 변경
    slot.user_id = userId;
    slot.status = CounselingStatus.PENDING;
    slot.reason = bookingData.reason;
    slot.appointment_date = scheduleDateTime;
    slot.payment_amount = slot.expertProfile?.hourly_rate || 0;
    
    const savedCounseling = await this.counselingRepository.save(slot);

    // RabbitMQ로 예약 요청 이벤트 발행
    const bookingEvent: CounselingBookingRequestedEvent = {
      counselingId: savedCounseling.id,
      userId: userId,
      expertId: slot.expert_id,
      scheduleId: savedCounseling.id, // 통합 시스템에서는 counseling id가 곧 schedule id
      reason: bookingData.reason,
      requestedAt: new Date(),
    };

    await this.rabbitmqService.publishEvent(
      CounselingEventType.BOOKING_REQUESTED,
      bookingEvent
    );

    // 알림 생성
    await this.notificationsService.createNotification(
      slot.expert_id,
      '새로운 상담 요청',
      `새로운 상담 요청이 있습니다: ${bookingData.reason}`,
      NotificationType.COUNSELING,
      savedCounseling.id,
      { counseling_id: savedCounseling.id }
    );
    
    return plainToClass(CounselingResponseDto, savedCounseling, {
      excludeExtraneousValues: true,
    });
  }

  // 기존 createCounselingRequest를 대체하는 새로운 메서드
  async createCounselingRequest(userId: number, createDto: CreateCounselingDto): Promise<CounselingResponseDto> {
    // 슬롯 ID가 제공된 경우 bookSlot 메서드 사용
    if (createDto.slot_id) {
      return this.bookSlot(createDto.slot_id, userId, {
        reason: createDto.reason
      });
    }

    // 슬롯 ID가 없는 경우, 직접 상담 요청 생성 (레거시 지원)
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const expert = await this.userRepository.findOne({ 
      where: { id: createDto.expert_id, user_type: UserType.EXPERT } 
    });
    if (!expert) {
      throw new NotFoundException('전문가를 찾을 수 없습니다.');
    }

    const expertProfile = await this.expertProfileRepository.findOne({
      where: { user_id: createDto.expert_id }
    });

    const counseling = this.counselingRepository.create({
      user_id: userId,
      expert_id: createDto.expert_id,
      reason: createDto.reason,
      type: createDto.type || CounselingType.VIDEO,
      status: CounselingStatus.PENDING,
      payment_amount: expertProfile?.hourly_rate || 0,
      schedule_date: createDto.preferred_date,
      start_time: createDto.preferred_start_time,
      end_time: createDto.preferred_end_time,
      duration: createDto.duration || 60,
    });

    const savedCounseling = await this.counselingRepository.save(counseling);

    return plainToClass(CounselingResponseDto, savedCounseling, {
      excludeExtraneousValues: true,
    });
  }

  // 예약 가능한 슬롯 조회
  async getAvailableSlots(expertId: number, date?: string): Promise<CounselingResponseDto[]> {
    const where: any = {
      expert_id: expertId,
      user_id: IsNull(),
      status: CounselingStatus.AVAILABLE
    };

    if (date) {
      where.schedule_date = date;
    }

    const slots = await this.counselingRepository.find({
      where,
      relations: ['expert', 'expertProfile'],
      order: {
        schedule_date: 'ASC',
        start_time: 'ASC'
      }
    });

    return slots.map(slot => 
      plainToClass(CounselingResponseDto, slot, { excludeExtraneousValues: true })
    );
  }

  // ===== CounselingUnified 기능 이관 =====
  
  /**
   * 전문가의 모든 일정 조회 (전체 일정 페이지용)
   */
  async getExpertAllSchedules(expertUserId: number): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({
      where: { id: expertUserId },
      relations: ['expertProfile']
    });
    
    if (!expert || !expert.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }
    
    return await this.counselingRepository.find({
      where: { expert_id: expertUserId },
      relations: ['user', 'expert', 'expertProfile'],
      order: { schedule_date: 'ASC', start_time: 'ASC' }
    });
  }

  /**
   * 전문가의 오늘 일정 조회 (오늘의 일정 페이지용)
   */
  async getExpertTodaySchedules(expertUserId: number): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({
      where: { id: expertUserId },
      relations: ['expertProfile']
    });
    
    if (!expert || !expert.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    return await this.counselingRepository.find({
      where: { 
        expert_id: expertUserId,
        schedule_date: today
      },
      relations: ['user', 'expert', 'expertProfile'],
      order: { start_time: 'ASC' }
    });
  }

  /**
   * 전문가의 진행 중 & 예정 채팅 상담 조회
   */
  async getExpertActiveAndUpcomingChats(expertUserId: number): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({
      where: { id: expertUserId },
      relations: ['expertProfile']
    });
    
    if (!expert || !expert.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const results = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .where('counseling.expert_id = :expertId', { expertId: expertUserId })
      .andWhere('counseling.type = :type', { type: CounselingType.CHAT })
      .andWhere('counseling.status IN (:...statuses)', { 
        statuses: [
          CounselingStatus.AVAILABLE,
          CounselingStatus.PENDING,
          CounselingStatus.APPROVED,
          CounselingStatus.IN_PROGRESS
        ]
      })
      .orderBy('counseling.schedule_date', 'ASC')
      .addOrderBy('counseling.start_time', 'ASC')
      .getMany();
    
    // 상태 기반 정확한 필터링
    return results.filter(counseling => {
      if (!counseling.schedule_date || !counseling.start_time || !counseling.end_time) {
        return false;
      }
      
      const sessionStart = new Date(`${counseling.schedule_date}T${counseling.start_time}`);
      const sessionEnd = new Date(`${counseling.schedule_date}T${counseling.end_time}`);
      
      // 1. IN_PROGRESS 상태는 시간과 관계없이 표시
      if (counseling.status === CounselingStatus.IN_PROGRESS) {
        return true;
      }
      
      // 2. 예정 상태: 시작 시간이 아직 안됨
      if (now < sessionStart) {
        return true;
      }
      
      // 3. 진행 중: 시작되었지만 아직 끝나지 않음
      if (now >= sessionStart && now <= sessionEnd) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * 전문가의 완료된 채팅 상담 조회
   */
  async getExpertCompletedChats(expertUserId: number): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({
      where: { id: expertUserId },
      relations: ['expertProfile']
    });
    
    if (!expert || !expert.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }
    
    return await this.counselingRepository.find({
      where: {
        expert_id: expertUserId,
        type: CounselingType.CHAT,
        status: CounselingStatus.COMPLETED
      },
      relations: ['user', 'expert', 'expertProfile'],
      order: { schedule_date: 'DESC', start_time: 'DESC' }
    });
  }

  /**
   * 전문가의 기간 지난 채팅 상담 조회
   */
  async getExpertExpiredChats(expertUserId: number): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({
      where: { id: expertUserId },
      relations: ['expertProfile']
    });
    
    if (!expert || !expert.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const results = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .where('counseling.expert_id = :expertId', { expertId: expertUserId })
      .andWhere('counseling.type = :type', { type: CounselingType.CHAT })
      .andWhere('counseling.status IN (:...statuses)', { 
        statuses: [
          CounselingStatus.APPROVED,
          CounselingStatus.PENDING
        ]
      })
      .orderBy('counseling.schedule_date', 'DESC')
      .addOrderBy('counseling.start_time', 'DESC')
      .getMany();
    
    // 기간이 지난 것들만 필터링
    return results.filter(counseling => {
      if (!counseling.schedule_date || !counseling.end_time) {
        return false;
      }
      
      const sessionEnd = new Date(`${counseling.schedule_date}T${counseling.end_time}`);
      return now > sessionEnd;
    });
  }

  /**
   * 전문가의 진행 중 & 예정 화상 상담 조회
   */
  async getExpertActiveAndUpcomingVideos(expertUserId: number): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({
      where: { id: expertUserId },
      relations: ['expertProfile']
    });
    
    if (!expert || !expert.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }
    
    const now = new Date();
    
    const results = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .where('counseling.expert_id = :expertId', { expertId: expertUserId })
      .andWhere('counseling.type = :type', { type: CounselingType.VIDEO })
      .andWhere('counseling.status IN (:...statuses)', { 
        statuses: [
          CounselingStatus.AVAILABLE,
          CounselingStatus.PENDING,
          CounselingStatus.APPROVED,
          CounselingStatus.IN_PROGRESS
        ]
      })
      .orderBy('counseling.schedule_date', 'ASC')
      .addOrderBy('counseling.start_time', 'ASC')
      .getMany();
    
    // 활성 및 예정 세션만 필터링
    return results.filter(counseling => {
      if (!counseling.schedule_date || !counseling.start_time || !counseling.end_time) {
        return false;
      }
      
      const sessionStart = new Date(`${counseling.schedule_date}T${counseling.start_time}`);
      const sessionEnd = new Date(`${counseling.schedule_date}T${counseling.end_time}`);
      
      // IN_PROGRESS는 항상 포함
      if (counseling.status === CounselingStatus.IN_PROGRESS) {
        return true;
      }
      
      // 예정이거나 진행 중인 것들
      return now <= sessionEnd;
    });
  }

  /**
   * 전문가의 완료된 화상 상담 조회
   */
  async getExpertCompletedVideos(expertUserId: number): Promise<Counseling[]> {
    const expert = await this.userRepository.findOne({
      where: { id: expertUserId },
      relations: ['expertProfile']
    });
    
    if (!expert || !expert.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }
    
    return await this.counselingRepository.find({
      where: {
        expert_id: expertUserId,
        type: CounselingType.VIDEO,
        status: CounselingStatus.COMPLETED
      },
      relations: ['user', 'expert', 'expertProfile'],
      order: { schedule_date: 'DESC', start_time: 'DESC' }
    });
  }

  async getMyCounselings(userId: number): Promise<CounselingResponseDto[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    let counselings;

    if (user.user_type === UserType.EXPERT) {
      // 전문가인 경우: 자신과 관련된 모든 상담 조회
      counselings = await this.counselingRepository
        .createQueryBuilder('counseling')
        .leftJoinAndSelect('counseling.user', 'user')
        .leftJoinAndSelect('counseling.expert', 'expert')
        .leftJoinAndSelect('counseling.expertProfile', 'expertProfile')
        .where('counseling.expert_id = :userId OR counseling.user_id = :userId', { userId })
        .orderBy('counseling.created_at', 'DESC')
        .getMany();
    } else {
      // 일반 사용자인 경우: 본인이 요청한 상담만 조회
      counselings = await this.counselingRepository
        .createQueryBuilder('counseling')
        .leftJoinAndSelect('counseling.user', 'user')
        .leftJoinAndSelect('counseling.expert', 'expert')
        .leftJoinAndSelect('counseling.expertProfile', 'expertProfile')
        .where('counseling.user_id = :userId', { userId })
        .orderBy('counseling.created_at', 'DESC')
        .getMany();
    }

    return counselings.map(counseling => 
      plainToClass(CounselingResponseDto, counseling, {
        excludeExtraneousValues: true,
      })
    );
  }

  async updateCounselingStatus(
    counselingId: number, 
    userId: number, 
    updateDto: UpdateCounselingStatusDto
  ): Promise<CounselingResponseDto> {
    // 사용자의 전문가 프로필 조회
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['expertProfile']
    });
    
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (user.user_type !== UserType.EXPERT || !user.expertProfile) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    const counseling = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      // .leftJoinAndSelect('counseling.schedule', 'schedule') // Removed - schedules migrated to counselings
      .where('counseling.id = :id', { id: counselingId })
      .getOne();

    if (!counseling) {
      throw new NotFoundException('상담을 찾을 수 없습니다.');
    }

    // 권한 확인: 해당 상담의 전문가만 상태 변경 가능
    if (counseling.expert_id !== user.expertProfile.id) {
      throw new ForbiddenException('상담 상태를 변경할 권한이 없습니다.');
    }

    // 현재 상태에서 변경 가능한 상태인지 확인
    if (counseling.status !== CounselingStatus.PENDING && counseling.status !== CounselingStatus.SCHEDULE_PROPOSED) {
      throw new BadRequestException('대기 중이거나 일정이 제안된 상담만 상태를 변경할 수 있습니다.');
    }

    // 상태 업데이트
    counseling.status = updateDto.status;
    const updatedCounseling = await this.counselingRepository.save(counseling);

    // 상태에 따라 적절한 이벤트 발행
    if (updateDto.status === CounselingStatus.APPROVED) {
      await this.rabbitmqService.publishEvent(
        CounselingEventType.BOOKING_APPROVED,
        {
          counselingId: counseling.id,
          userId: counseling.user_id,
          expertId: counseling.expert_id,
          // scheduleId: counseling.schedule_id, // Removed - schedules migrated to counselings
          appointmentDate: counseling.appointment_date,
          approvedAt: new Date(),
        }
      );
    } else if (updateDto.status === CounselingStatus.REJECTED) {
      await this.rabbitmqService.publishEvent(
        CounselingEventType.BOOKING_REJECTED,
        {
          counselingId: counseling.id,
          userId: counseling.user_id,
          expertId: counseling.expert_id,
          // scheduleId: counseling.schedule_id, // Removed - schedules migrated to counselings
          rejectedAt: new Date(),
          reason: updateDto.rejection_reason || updateDto.notes,
        }
      );
    }

    return plainToClass(CounselingResponseDto, updatedCounseling, {
      excludeExtraneousValues: true,
    });
  }

  async getCounselingDetail(counselingId: number, userId: number): Promise<CounselingResponseDto> {
    // 사용자 정보 조회 (일반 사용자 또는 전문가 확인)
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['expertProfile']
    });
    
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const counseling = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
            // .leftJoinAndSelect('counseling.schedule', 'schedule') // Removed - schedules migrated to counselings
      .where('counseling.id = :id', { id: counselingId })
      .getOne();

    if (!counseling) {
      throw new NotFoundException('상담을 찾을 수 없습니다.');
    }

    // 권한 확인: 해당 상담의 사용자 또는 전문가만 조회 가능
    const isClient = counseling.user_id === userId;
    const isExpert = user.expertProfile && counseling.expert_id === user.expertProfile.id;
    
    if (!isClient && !isExpert) {
      throw new ForbiddenException('상담 정보를 조회할 권한이 없습니다.');
    }

    return plainToClass(CounselingResponseDto, counseling, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 전문가의 신규 상담 요청 목록 조회 (PENDING 상태만)
   */
  // 대시보드용 - 대기 중인 요청만
  async getPendingRequestsForDashboard(userId: number): Promise<CounselingResponseDto[]> {
    // 사용자의 전문가 프로필 조회
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['expertProfile']
    });
    
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (!user.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    const expertId = user.expertProfile.id;

    const pendingCounselings = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      // .leftJoinAndSelect('counseling.schedule', 'schedule') // Removed - schedules migrated to counselings
      .where('counseling.expert_id = :expertId', { expertId })
      .andWhere('counseling.status = :status', { status: CounselingStatus.PENDING })
      .orderBy('counseling.created_at', 'DESC')
      .limit(5) // 대시보드에는 최대 5개만
      .getMany();

    return pendingCounselings.map(counseling => 
      plainToClass(CounselingResponseDto, counseling, {
        excludeExtraneousValues: true,
      })
    );
  }

  // 신규요청 페이지용 - 모든 상태
  async getNewRequestsForExpert(userId: number): Promise<CounselingResponseDto[]> {
    // 사용자의 전문가 프로필 조회
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['expertProfile']
    });
    
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (!user.expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    const expertId = user.expertProfile.id;

    const pendingCounselings = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      // .leftJoinAndSelect('counseling.schedule', 'schedule') // Removed - schedules migrated to counselings
      .where('counseling.expert_id = :expertId', { expertId })
      .andWhere('counseling.status IN (:...statuses)', { 
        statuses: [CounselingStatus.PENDING, CounselingStatus.SCHEDULE_PROPOSED, CounselingStatus.APPROVED, CounselingStatus.REJECTED] 
      })
      .orderBy('counseling.created_at', 'DESC')
      .getMany();

    return pendingCounselings.map(counseling => 
      plainToClass(CounselingResponseDto, counseling, {
        excludeExtraneousValues: true,
      })
    );
  }

  /**
   * 전문가 대시보드 통계 데이터 조회
   */
  async getExpertDashboardStats(userId: number): Promise<any> {
    try {
      console.log('[getDashboardStats] userId:', userId);
      
      const user = await this.userRepository.findOne({ 
        where: { id: userId } 
      });
      
      if (!user) {
        console.error('[getDashboardStats] User not found:', userId);
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      console.log('[getDashboardStats] User type:', user.user_type);

      // Expert profile 조회
      const expertProfile = await this.expertProfileRepository.findOne({
        where: { user_id: userId }
      });

      if (!expertProfile) {
        console.error('[getDashboardStats] Expert profile not found for userId:', userId);
        // 전문가 프로필이 없는 경우 기본값 반환
        return {
          todayCount: 0,
          newRequestsCount: 0,
          thisWeekCount: 0,
          totalClientsCount: 0
        };
      }

      const expertId = expertProfile.id;
      console.log('[getDashboardStats] Expert profile id:', expertId);

    const today = new Date().toISOString().split('T')[0];
    
    // 이번 주 시작일과 종료일 계산
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const weekStart = startOfWeek.toISOString().split('T')[0];
    const weekEnd = endOfWeek.toISOString().split('T')[0];

    // 오늘 상담 수 (완료된 것만)
    const todayCount = await this.counselingRepository
      .createQueryBuilder('counseling')
      .where('counseling.expert_id = :expertId', { expertId })
      .andWhere('counseling.schedule_date = :today', { today })
      .andWhere('counseling.status = :status', { status: CounselingStatus.COMPLETED })
      .getCount();

    // 신규 요청 수 (PENDING 상태)
    const newRequestsCount = await this.counselingRepository
      .createQueryBuilder('counseling')
      .where('counseling.expert_id = :expertId', { expertId })
      .andWhere('counseling.status = :status', { status: CounselingStatus.PENDING })
      .getCount();

    // 이번 주 상담 수 (완료된 것만)
    const thisWeekCount = await this.counselingRepository
      .createQueryBuilder('counseling')
      .where('counseling.expert_id = :expertId', { expertId })
      .andWhere('counseling.schedule_date >= :weekStart', { weekStart })
      .andWhere('counseling.schedule_date <= :weekEnd', { weekEnd })
      .andWhere('counseling.status = :status', { status: CounselingStatus.COMPLETED })
      .getCount();

    // 총 내담자 수 (COMPLETED 상태의 고유 사용자)
    const totalClientsResult = await this.counselingRepository
      .createQueryBuilder('counseling')
      .select('COUNT(DISTINCT counseling.user_id)', 'count')
      .where('counseling.expert_id = :expertId', { expertId })
      .andWhere('counseling.status = :status', { status: CounselingStatus.COMPLETED })
      .andWhere('counseling.user_id IS NOT NULL')
      .getRawOne();
    
    const totalClientsCount = parseInt(totalClientsResult?.count || '0');

    return {
      todayCount,
      newRequestsCount,
      thisWeekCount,
      totalClientsCount
    };
    } catch (error) {
      console.error('[getDashboardStats] Error:', error);
      throw error;
    }
  }

  /**
   * 내담자가 제안된 일정을 승인하는 메서드
   */
  async approveScheduleProposal(counselingId: number, userId: number): Promise<CounselingResponseDto> {
    const counseling = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
            // .leftJoinAndSelect('counseling.schedule', 'schedule') // Removed - schedules migrated to counselings
      .where('counseling.id = :id', { id: counselingId })
      .getOne();

    if (!counseling) {
      throw new NotFoundException('상담 요청을 찾을 수 없습니다.');
    }

    // 권한 확인: 해당 상담의 내담자만 승인 가능
    if (counseling.user_id !== userId) {
      throw new ForbiddenException('해당 상담을 승인할 권한이 없습니다.');
    }

    // 상태 확인: schedule_proposed 상태만 승인 가능
    if (counseling.status !== CounselingStatus.SCHEDULE_PROPOSED) {
      throw new BadRequestException('일정이 제안된 상담만 승인할 수 있습니다.');
    }

    // 상담 상태를 승인으로 변경
    counseling.status = CounselingStatus.APPROVED;
    const updatedCounseling = await this.counselingRepository.save(counseling);

    // 일정 상태 업데이트는 통합 상담 시스템에서 자동 처리됨
    console.log('상담 승인됨 - 통합 상담 시스템에서 처리');

    // 전문가에게 승인 알림 발송
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      const expertProfile = await this.expertProfileRepository.findOne({ where: { id: counseling.expert_id } });
      const expert = expertProfile ? await this.userRepository.findOne({ where: { id: expertProfile.user_id } }) : null;
      
      if (expert && counseling.schedule_date && counseling.start_time && counseling.end_time) {
        const scheduleDate = new Date(counseling.schedule_date).toLocaleDateString('ko-KR');
        const scheduleTime = `${counseling.start_time} - ${counseling.end_time}`;
        const clientName = user?.name || '내담자';
        
        await this.notificationsService.createNotification(
          expert.id,
          '✅ 일정 승인 완료',
          `${clientName}님이 ${scheduleDate} ${scheduleTime} 일정을 승인했습니다. 상담 준비를 해주세요.`,
          NotificationType.SCHEDULE,
          counseling.id,
          {
            action: 'schedule_approved',
            counseling_id: counseling.id,
            client_name: clientName,
            schedule_date: scheduleDate,
            schedule_time: scheduleTime
          }
        );
      }
    } catch (notificationError) {
      console.error('전문가 알림 발송 실패:', notificationError);
    }

    // RabbitMQ 이벤트 발행
    await this.rabbitmqService.publishEvent(
      CounselingEventType.BOOKING_APPROVED,
      {
        counselingId: counseling.id,
        userId: counseling.user_id,
        expertId: counseling.expert_id,
        appointmentDate: counseling.appointment_date,
        approvedAt: new Date(),
      }
    );

    return plainToClass(CounselingResponseDto, updatedCounseling, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 내담자가 제안된 일정을 거절하는 메서드
   */
  async rejectScheduleProposal(counselingId: number, userId: number, rejectionReason?: string): Promise<CounselingResponseDto> {
    const counseling = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
            // .leftJoinAndSelect('counseling.schedule', 'schedule') // Removed - schedules migrated to counselings
      .where('counseling.id = :id', { id: counselingId })
      .getOne();

    if (!counseling) {
      throw new NotFoundException('상담 요청을 찾을 수 없습니다.');
    }

    // 권한 확인: 해당 상담의 내담자만 거절 가능
    if (counseling.user_id !== userId) {
      throw new ForbiddenException('해당 상담을 거절할 권한이 없습니다.');
    }

    // 상태 확인: schedule_proposed 상태만 거절 가능
    if (counseling.status !== CounselingStatus.SCHEDULE_PROPOSED) {
      throw new BadRequestException('일정이 제안된 상담만 거절할 수 있습니다.');
    }

    // 상담 상태를 거절로 변경 (다시 pending으로 변경하여 재협의 가능)
    counseling.status = CounselingStatus.PENDING;
    // counseling.schedule_id = null; // 일정 연결 해제 - Removed: schedules migrated to counselings
    const updatedCounseling = await this.counselingRepository.save(counseling);

    // 연결된 일정 처리는 통합 상담 시스템에서 자동 처리됨
    console.log('상담 취소됨 - 통합 상담 시스템에서 슬롯 해제 처리');

    // 전문가에게 거절 알림 발송
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      const expertProfile = await this.expertProfileRepository.findOne({ where: { id: counseling.expert_id } });
      const expert = expertProfile ? await this.userRepository.findOne({ where: { id: expertProfile.user_id } }) : null;
      
      if (expert && counseling.schedule_date && counseling.start_time && counseling.end_time) {
        const scheduleDate = new Date(counseling.schedule_date).toLocaleDateString('ko-KR');
        const scheduleTime = `${counseling.start_time} - ${counseling.end_time}`;
        const clientName = user?.name || '내담자';
        const reason = rejectionReason ? ` (사유: ${rejectionReason})` : '';
        
        await this.notificationsService.createNotification(
          expert.id,
          '❌ 일정 거절됨',
          `${clientName}님이 ${scheduleDate} ${scheduleTime} 일정을 거절했습니다${reason}. 새로운 일정을 제안해 주세요.`,
          NotificationType.SCHEDULE,
          counseling.id,
          {
            action: 'schedule_rejected',
            counseling_id: counseling.id,
            client_name: clientName,
            rejection_reason: rejectionReason,
            schedule_date: scheduleDate,
            schedule_time: scheduleTime
          }
        );
      }
    } catch (notificationError) {
      console.error('전문가 알림 발송 실패:', notificationError);
    }

    // RabbitMQ 이벤트 발행
    await this.rabbitmqService.publishEvent(
      CounselingEventType.BOOKING_REJECTED,
      {
        counselingId: counseling.id,
        userId: counseling.user_id,
        expertId: counseling.expert_id,
        rejectedAt: new Date(),
        reason: rejectionReason,
      }
    );

    return plainToClass(CounselingResponseDto, updatedCounseling, {
      excludeExtraneousValues: true,
    });
  }
}
