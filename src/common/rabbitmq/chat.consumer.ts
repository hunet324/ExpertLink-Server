import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from '../../entities/chat-room.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { User } from '../../entities/user.entity';
import { 
  ChatEventType, 
  ChatMessageSentEvent,
  ChatMessageReadEvent,
  ChatUserStatusEvent 
} from '../events/chat.events';
import { RedisService } from '../../config/redis.config';

@Injectable()
export class ChatConsumer implements OnModuleInit {
  private readonly logger = new Logger(ChatConsumer.name);

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly redisService: RedisService,
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    // RabbitMQ 설정 완료 대기
    setTimeout(async () => {
      try {
        await this.setupChatConsumers();
      } catch (error) {
        this.logger.warn('Chat consumer setup failed, continuing without chat consumers', error.message);
      }
    }, 3000);
  }

  private async setupChatConsumers() {
    const publisherChannel = this.rabbitmqService.getPublisherChannel();
    
    if (!publisherChannel) {
      this.logger.warn('RabbitMQ publisher channel not available, skipping chat consumer setup');
      return;
    }

    // 채팅 메시지 처리 큐 설정
    await publisherChannel.addSetup(async (channel) => {
      // 채팅 전용 Exchange와 Queue 생성
      await channel.assertExchange('chat.events', 'topic', { durable: true });
      
      const chatQueues = [
        { name: 'chat.messages', routingKey: 'chat.message.*' },
        { name: 'chat.status', routingKey: 'chat.user.*' },
        { name: 'chat.notifications', routingKey: 'chat.*' },
        { name: 'chat.analytics', routingKey: 'chat.*' },
      ];

      for (const queue of chatQueues) {
        await channel.assertQueue(queue.name, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': 'chat.dlx',
            'x-dead-letter-routing-key': 'dead-letter',
            'x-message-ttl': 24 * 60 * 60 * 1000, // 24시간
          },
        });

        await channel.bindQueue(queue.name, 'chat.events', queue.routingKey);
      }

      // Dead Letter Exchange for chat
      await channel.assertExchange('chat.dlx', 'direct', { durable: true });
      await channel.assertQueue('chat.dead-letters', { durable: true });
      await channel.bindQueue('chat.dead-letters', 'chat.dlx', 'dead-letter');

      this.logger.log('Chat RabbitMQ queues setup completed');
    });

    // 컨슈머 설정
    await this.rabbitmqService.subscribe('chat.messages', async (data, message) => {
      await this.handleMessageEvent(data);
    });

    await this.rabbitmqService.subscribe('chat.status', async (data, message) => {
      await this.handleUserStatusEvent(data);
    });

    await this.rabbitmqService.subscribe('chat.notifications', async (data, message) => {
      await this.handleChatNotificationEvent(data);
    });

    this.logger.log('Chat consumers setup completed');
  }

  private async handleMessageEvent(data: any) {
    const eventType = this.getEventTypeFromRoutingKey(data.routingKey || '');
    
    try {
      switch (eventType) {
        case ChatEventType.MESSAGE_SENT:
          await this.handleMessageSent(data as ChatMessageSentEvent);
          break;
        case ChatEventType.MESSAGE_READ:
          await this.handleMessageRead(data as ChatMessageReadEvent);
          break;
        default:
          this.logger.warn(`Unknown chat message event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error handling chat message event: ${eventType}`, error);
      throw error;
    }
  }

  private async handleMessageSent(event: ChatMessageSentEvent) {
    this.logger.log(`Processing message sent: ${event.messageId}`);

    try {
      // 메시지 존재 확인 (이미 저장되어 있어야 함)
      const message = await this.chatMessageRepository.findOne({
        where: { id: event.messageId },
        relations: ['sender', 'room'],
      });

      if (!message) {
        this.logger.warn(`Message not found: ${event.messageId}`);
        return;
      }

      // 채팅방 last_message_at 업데이트
      await this.chatRoomRepository.update(event.roomId, {
        last_message_at: event.sentAt,
      });

      // 참여자들의 읽지 않은 메시지 카운트 증가 (발신자 제외)
      const room = await this.chatRoomRepository.findOne({
        where: { id: event.roomId }
      });

      if (room) {
        for (const participantId of room.participants) {
          if (participantId !== event.senderId) {
            await this.redisService.increment(`unread_count:${participantId}:${event.roomId}`);
          }
        }
      }

      // 알림 카운트 업데이트
      const participants = room?.participants.filter(id => id !== event.senderId) || [];
      for (const participantId of participants) {
        await this.redisService.increment(`notification_count:${participantId}`);
      }

      this.logger.log(`Message processed successfully: ${event.messageId}`);
    } catch (error) {
      this.logger.error(`Error processing message sent event: ${event.messageId}`, error);
      throw error;
    }
  }

  private async handleMessageRead(event: ChatMessageReadEvent) {
    this.logger.log(`Processing message read: ${event.messageId} by user ${event.readerId}`);

    try {
      // 메시지를 읽음으로 표시
      await this.chatMessageRepository.update(event.messageId, {
        is_read: true,
        read_at: event.readAt,
      });

      // 읽지 않은 메시지 카운트 감소
      const currentCount = await this.redisService.get(`unread_count:${event.readerId}:${event.roomId}`);
      if (currentCount && parseInt(currentCount) > 0) {
        await this.redisService.decrement(`unread_count:${event.readerId}:${event.roomId}`);
      }

      this.logger.log(`Message read processed successfully: ${event.messageId}`);
    } catch (error) {
      this.logger.error(`Error processing message read event: ${event.messageId}`, error);
      throw error;
    }
  }

  private async handleUserStatusEvent(data: ChatUserStatusEvent) {
    this.logger.log(`Processing user status event: ${data.userId} - ${data.status}`);

    try {
      // Redis에 사용자 상태 업데이트
      if (data.status === 'online') {
        await this.redisService.setAdd('online_users', data.userId.toString());
        await this.redisService.set(`user_last_seen:${data.userId}`, data.timestamp.toISOString(), 86400);
      } else {
        await this.redisService.setRemove('online_users', data.userId.toString());
        await this.redisService.set(`user_last_seen:${data.userId}`, data.timestamp.toISOString(), 86400 * 7);
      }

      // 사용자가 참여한 채팅방들을 찾아서 다른 참여자들에게 알림
      const userRooms = await this.chatRoomRepository
        .createQueryBuilder('room')
        .where(':userId = ANY(room.participants)', { userId: data.userId })
        .andWhere('room.status = :status', { status: 'active' })
        .getMany();

      // 실제 WebSocket을 통한 알림은 ChatGateway에서 처리됨
      
      this.logger.log(`User status processed: ${data.userId} - ${data.status}`);
    } catch (error) {
      this.logger.error(`Error processing user status event: ${data.userId}`, error);
      throw error;
    }
  }

  private async handleChatNotificationEvent(data: any) {
    this.logger.log('Processing chat notification event', data);
    
    // 실제 알림 발송 로직 (푸시 알림, 이메일 등)
    // 여기서는 로깅만 수행하고, 실제 구현은 별도의 NotificationService에서 처리
  }

  private getEventTypeFromRoutingKey(routingKey: string): string {
    const eventMapping: { [key: string]: string } = {
      'chat.message.sent': ChatEventType.MESSAGE_SENT,
      'chat.message.read': ChatEventType.MESSAGE_READ,
      'chat.user.online': ChatEventType.USER_ONLINE,
      'chat.user.offline': ChatEventType.USER_OFFLINE,
      'chat.room.created': ChatEventType.ROOM_CREATED,
      'chat.room.joined': ChatEventType.ROOM_JOINED,
      'chat.room.left': ChatEventType.ROOM_LEFT,
      'chat.typing.start': ChatEventType.TYPING_START,
      'chat.typing.end': ChatEventType.TYPING_END,
    };

    return eventMapping[routingKey] || routingKey;
  }

  // 채팅방별 읽지 않은 메시지 수 조회 헬퍼
  async getUnreadCount(userId: number, roomId: number): Promise<number> {
    const count = await this.redisService.get(`unread_count:${userId}:${roomId}`);
    return count ? parseInt(count) : 0;
  }

  // 사용자의 온라인 상태 확인 헬퍼
  async isUserOnline(userId: number): Promise<boolean> {
    const isOnline = await this.redisService.setMembers('online_users');
    return isOnline.includes(userId.toString());
  }
}