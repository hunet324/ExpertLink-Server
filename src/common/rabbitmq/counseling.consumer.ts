import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counseling, CounselingStatus } from '../../entities/counseling.entity';
import { Schedule, ScheduleStatus } from '../../entities/schedule.entity';
import { 
  CounselingEventType, 
  CounselingBookingRequestedEvent,
  CounselingBookingApprovedEvent,
  CounselingBookingRejectedEvent 
} from '../events/counseling.events';
import { RedisService } from '../../config/redis.config';
import { ChatService } from '../../chat/chat.service';

@Injectable()
export class CounselingConsumer implements OnModuleInit {
  private readonly logger = new Logger(CounselingConsumer.name);

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly redisService: RedisService,
    private readonly chatService: ChatService,
    @InjectRepository(Counseling)
    private counselingRepository: Repository<Counseling>,
    @InjectRepository(Schedule)
    private scheduleRepository: Repository<Schedule>,
  ) {}

  async onModuleInit() {
    await this.setupConsumers();
  }

  private async setupConsumers() {
    // 상담 예약 처리 큐
    await this.rabbitmqService.subscribe('counseling.booking', async (data, message) => {
      await this.handleBookingEvent(data);
    });

    // 알림 처리 큐
    await this.rabbitmqService.subscribe('counseling.notifications', async (data, message) => {
      await this.handleNotificationEvent(data);
    });

    // 결제 처리 큐
    await this.rabbitmqService.subscribe('counseling.payments', async (data, message) => {
      await this.handlePaymentEvent(data);
    });

    this.logger.log('Counseling consumers setup completed');
  }

  private async handleBookingEvent(data: any) {
    const eventType = this.getEventTypeFromRoutingKey(data.routingKey || '');
    
    try {
      switch (eventType) {
        case CounselingEventType.BOOKING_REQUESTED:
          await this.handleBookingRequested(data as CounselingBookingRequestedEvent);
          break;
        case CounselingEventType.BOOKING_APPROVED:
          await this.handleBookingApproved(data as CounselingBookingApprovedEvent);
          break;
        case CounselingEventType.BOOKING_REJECTED:
          await this.handleBookingRejected(data as CounselingBookingRejectedEvent);
          break;
        default:
          this.logger.warn(`Unknown booking event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error handling booking event: ${eventType}`, error);
      throw error;
    }
  }

  private async handleBookingRequested(event: CounselingBookingRequestedEvent) {
    this.logger.log(`Processing booking request: ${event.counselingId}`);

    // Redis Lock으로 동시성 제어
    const lockKey = `booking_lock:${event.scheduleId}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    try {
      // 5초 동안 락 획득 시도
      await this.redisService.set(lockKey, lockValue, 5);
      
      // 락이 설정되었는지 확인
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock !== lockValue) {
        throw new Error('해당 시간대에 다른 예약이 진행 중입니다.');
      }

      // 일정 상태 확인 및 업데이트
      const schedule = await this.scheduleRepository.findOne({
        where: { id: event.scheduleId }
      });

      if (!schedule) {
        throw new Error('일정을 찾을 수 없습니다.');
      }

      if (schedule.status !== ScheduleStatus.AVAILABLE) {
        throw new Error('이미 예약된 일정입니다.');
      }

      // 일정을 예약됨으로 변경
      schedule.status = ScheduleStatus.BOOKED;
      await this.scheduleRepository.save(schedule);

      // 상담 정보 업데이트
      await this.counselingRepository.update(event.counselingId, {
        expert_id: event.expertId,
        schedule_id: event.scheduleId,
        appointment_date: new Date(`${schedule.schedule_date}T${schedule.start_time}`),
      });

      // 알림 이벤트 발행
      await this.rabbitmqService.publishEvent(
        CounselingEventType.BOOKING_APPROVED,
        {
          counselingId: event.counselingId,
          userId: event.userId,
          expertId: event.expertId,
          scheduleId: event.scheduleId,
          appointmentDate: new Date(`${schedule.schedule_date}T${schedule.start_time}`),
          approvedAt: new Date(),
        } as CounselingBookingApprovedEvent
      );

      this.logger.log(`Booking approved: ${event.counselingId}`);

    } finally {
      // 락 해제
      const currentValue = await this.redisService.get(lockKey);
      if (currentValue === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  private async handleBookingApproved(event: CounselingBookingApprovedEvent) {
    this.logger.log(`Processing booking approval: ${event.counselingId}`);

    // 상담 상태를 승인됨으로 업데이트
    await this.counselingRepository.update(event.counselingId, {
      status: CounselingStatus.APPROVED,
    });

    // 사용자와 전문가에게 알림 카운트 업데이트
    await this.redisService.increment(`notification_count:${event.userId}`);
    await this.redisService.increment(`notification_count:${event.expertId}`);

    // 상담이 승인되면 채팅방 자동 생성
    try {
      await this.chatService.createChatRoomFromCounseling(event.counselingId);
      this.logger.log(`Chat room created for counseling: ${event.counselingId}`);
    } catch (error) {
      this.logger.error(`Failed to create chat room for counseling: ${event.counselingId}`, error);
    }
  }

  private async handleBookingRejected(event: CounselingBookingRejectedEvent) {
    this.logger.log(`Processing booking rejection: ${event.counselingId}`);

    // 상담 상태를 거절됨으로 업데이트
    await this.counselingRepository.update(event.counselingId, {
      status: CounselingStatus.REJECTED,
    });

    // 일정을 다시 사용 가능으로 변경
    if (event.scheduleId) {
      await this.scheduleRepository.update(event.scheduleId, {
        status: ScheduleStatus.AVAILABLE,
      });
    }

    // 사용자에게 알림
    await this.redisService.increment(`notification_count:${event.userId}`);
  }

  private async handleNotificationEvent(data: any) {
    // 실제 알림 발송 로직 (이메일, 푸시 알림 등)
    this.logger.log('Processing notification event', data);
  }

  private async handlePaymentEvent(data: any) {
    // 결제 처리 로직
    this.logger.log('Processing payment event', data);
  }

  private getEventTypeFromRoutingKey(routingKey: string): string {
    const eventMapping: { [key: string]: string } = {
      'counseling.booking.requested': CounselingEventType.BOOKING_REQUESTED,
      'counseling.booking.approved': CounselingEventType.BOOKING_APPROVED,
      'counseling.booking.rejected': CounselingEventType.BOOKING_REJECTED,
      'counseling.booking.cancelled': CounselingEventType.BOOKING_CANCELLED,
      'counseling.session.completed': CounselingEventType.SESSION_COMPLETED,
      'counseling.payment.requested': CounselingEventType.PAYMENT_REQUESTED,
      'counseling.payment.completed': CounselingEventType.PAYMENT_COMPLETED,
    };

    return eventMapping[routingKey] || routingKey;
  }
}