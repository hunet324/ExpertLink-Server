import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counseling, CounselingStatus } from '../entities/counseling.entity';
import { Schedule, ScheduleStatus } from '../entities/schedule.entity';
import { User, UserType } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { CreateCounselingDto } from './dto/create-counseling.dto';
import { UpdateCounselingStatusDto } from './dto/update-counseling-status.dto';
import { CounselingResponseDto } from './dto/counseling-response.dto';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { CounselingEventType, CounselingBookingRequestedEvent } from '../common/events/counseling.events';
import { plainToClass } from 'class-transformer';

@Injectable()
export class CounselingsService {
  constructor(
    @InjectRepository(Counseling)
    private counselingRepository: Repository<Counseling>,
    @InjectRepository(Schedule)
    private scheduleRepository: Repository<Schedule>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ExpertProfile)
    private expertProfileRepository: Repository<ExpertProfile>,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  async createCounselingRequest(userId: number, createDto: CreateCounselingDto): Promise<CounselingResponseDto> {
    // 사용자 확인
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 전문가 확인
    const expert = await this.userRepository.findOne({ 
      where: { id: createDto.expert_id, user_type: UserType.EXPERT } 
    });
    if (!expert) {
      throw new NotFoundException('전문가를 찾을 수 없습니다.');
    }

    // 일정 확인
    const schedule = await this.scheduleRepository.findOne({
      where: { 
        id: createDto.schedule_id,
        expert_id: createDto.expert_id,
        status: ScheduleStatus.AVAILABLE
      }
    });

    if (!schedule) {
      throw new BadRequestException('예약 가능한 일정이 아닙니다.');
    }

    // 과거 날짜 확인
    const scheduleDateTime = new Date(`${schedule.schedule_date}T${schedule.start_time}`);
    if (scheduleDateTime < new Date()) {
      throw new BadRequestException('과거 일정에는 예약할 수 없습니다.');
    }

    // 중복 예약 확인
    const existingBooking = await this.counselingRepository.findOne({
      where: {
        user_id: userId,
        schedule_id: createDto.schedule_id,
        status: CounselingStatus.PENDING
      }
    });

    if (existingBooking) {
      throw new BadRequestException('이미 해당 일정에 예약 요청이 있습니다.');
    }

    // 전문가 프로필에서 요금 정보 가져오기
    const expertProfile = await this.expertProfileRepository.findOne({
      where: { user_id: createDto.expert_id }
    });

    // 상담 요청 생성
    const counseling = this.counselingRepository.create({
      user_id: userId,
      expert_id: createDto.expert_id,
      schedule_id: createDto.schedule_id,
      reason: createDto.reason,
      status: CounselingStatus.PENDING,
      payment_amount: expertProfile?.hourly_rate || 0,
    });

    const savedCounseling = await this.counselingRepository.save(counseling);

    // RabbitMQ로 예약 요청 이벤트 발행
    const bookingEvent: CounselingBookingRequestedEvent = {
      counselingId: savedCounseling.id,
      userId: userId,
      expertId: createDto.expert_id,
      scheduleId: createDto.schedule_id,
      reason: createDto.reason,
      requestedAt: new Date(),
    };

    await this.rabbitmqService.publishEvent(
      CounselingEventType.BOOKING_REQUESTED,
      bookingEvent
    );

    // 관계된 데이터와 함께 상담 정보 조회
    const counselingWithRelations = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .leftJoinAndSelect('counseling.schedule', 'schedule')
      .where('counseling.id = :id', { id: savedCounseling.id })
      .getOne();

    return plainToClass(CounselingResponseDto, counselingWithRelations, {
      excludeExtraneousValues: true,
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
        .leftJoinAndSelect('counseling.schedule', 'schedule')
        .where('counseling.expert_id = :userId OR counseling.user_id = :userId', { userId })
        .orderBy('counseling.created_at', 'DESC')
        .getMany();
    } else {
      // 일반 사용자인 경우: 본인이 요청한 상담만 조회
      counselings = await this.counselingRepository
        .createQueryBuilder('counseling')
        .leftJoinAndSelect('counseling.user', 'user')
        .leftJoinAndSelect('counseling.expert', 'expert')
        .leftJoinAndSelect('counseling.schedule', 'schedule')
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
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const counseling = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .leftJoinAndSelect('counseling.schedule', 'schedule')
      .where('counseling.id = :id', { id: counselingId })
      .getOne();

    if (!counseling) {
      throw new NotFoundException('상담을 찾을 수 없습니다.');
    }

    // 권한 확인: 전문가만 상태 변경 가능
    if (user.user_type !== UserType.EXPERT || counseling.expert_id !== userId) {
      throw new ForbiddenException('상담 상태를 변경할 권한이 없습니다.');
    }

    // 현재 상태에서 변경 가능한 상태인지 확인
    if (counseling.status !== CounselingStatus.PENDING) {
      throw new BadRequestException('대기 중인 상담만 상태를 변경할 수 있습니다.');
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
          scheduleId: counseling.schedule_id,
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
          scheduleId: counseling.schedule_id,
          rejectedAt: new Date(),
          reason: updateDto.rejection_reason,
        }
      );
    }

    return plainToClass(CounselingResponseDto, updatedCounseling, {
      excludeExtraneousValues: true,
    });
  }

  async getCounselingDetail(counselingId: number, userId: number): Promise<CounselingResponseDto> {
    const counseling = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .leftJoinAndSelect('counseling.schedule', 'schedule')
      .where('counseling.id = :id', { id: counselingId })
      .getOne();

    if (!counseling) {
      throw new NotFoundException('상담을 찾을 수 없습니다.');
    }

    // 권한 확인: 해당 상담의 사용자 또는 전문가만 조회 가능
    if (counseling.user_id !== userId && counseling.expert_id !== userId) {
      throw new ForbiddenException('상담 정보를 조회할 권한이 없습니다.');
    }

    return plainToClass(CounselingResponseDto, counseling, {
      excludeExtraneousValues: true,
    });
  }
}