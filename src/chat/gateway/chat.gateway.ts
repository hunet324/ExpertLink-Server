import { Logger, Injectable, UnauthorizedException, Controller, Post, Get, Body, Headers, Param, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '../chat.service';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { RedisService } from '../../config/redis.config';
import { 
  ChatEventType, 
  ChatMessageSentEvent, 
  ChatTypingEvent, 
  ChatUserStatusEvent,
  ChatMessageReadEvent 
} from '../../common/events/chat.events';
import { CreateMessageDto } from '../dto/create-message.dto';
import { TypingEventDto, JoinRoomDto, MarkMessageReadDto } from '../dto/typing-event.dto';

interface StompConnectionInfo {
  exchange: string;
  routingKey: string;
  queueName: string;
}

@Controller('chat-ws')
@Injectable()
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly redisService: RedisService,
  ) {}

  // JWT 토큰 검증 헬퍼 메소드
  private async validateToken(authorization: string): Promise<any> {
    const token = authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('토큰이 필요합니다');
    }

    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }
  }

  // 클라이언트 연결 정보 반환 (STOMP WebSocket 연결용)
  @Post('connect')
  async getConnectionInfo(@Headers('authorization') authorization: string) {
    const payload = await this.validateToken(authorization);
    
    // Redis에 온라인 상태 저장
    await this.redisService.setAdd('online_users', payload.sub.toString());
    
    // 온라인 상태 이벤트 발행
    await this.rabbitmqService.publishEvent(
      ChatEventType.USER_ONLINE,
      {
        userId: payload.sub,
        status: 'online',
        timestamp: new Date(),
      } as ChatUserStatusEvent
    );

    // 사용자가 참여한 채팅방 조회
    const chatRooms = await this.chatService.getUserChatRooms(payload.sub);
    
    return {
      status: 'success',
      connectionInfo: {
        stompUrl: 'ws://localhost:15674/ws',
        username: 'guest', // RabbitMQ 기본 사용자
        password: 'guest',
        vhost: '/',
      },
      subscriptions: chatRooms.map(room => ({
        destination: `/exchange/chat.direct/room.${room.id}`,
        roomId: room.id,
        roomName: room.room_name,
      })),
      userInfo: {
        userId: payload.sub,
        email: payload.email,
        userType: payload.user_type,
      }
    };
  }

  // 연결 해제 처리
  @Post('disconnect')
  async handleDisconnect(@Headers('authorization') authorization: string) {
    const payload = await this.validateToken(authorization);
    
    // Redis에서 온라인 상태 제거
    await this.redisService.setRemove('online_users', payload.sub.toString());
    
    // 오프라인 상태 이벤트 발행
    await this.rabbitmqService.publishEvent(
      ChatEventType.USER_OFFLINE,
      {
        userId: payload.sub,
        status: 'offline',
        timestamp: new Date(),
      } as ChatUserStatusEvent
    );

    return { status: 'disconnected' };
  }

  // 방 참여
  @Post('join-room')
  async joinRoom(
    @Headers('authorization') authorization: string,
    @Body() joinRoomDto: JoinRoomDto
  ) {
    const payload = await this.validateToken(authorization);
    
    // 사용자가 해당 방에 참여할 권한이 있는지 확인
    const hasAccess = await this.chatService.canAccessRoom(joinRoomDto.roomId, payload.sub);
    if (!hasAccess) {
      throw new UnauthorizedException('채팅방에 접근할 권한이 없습니다');
    }

    // RabbitMQ 이벤트 발행
    await this.rabbitmqService.publishEvent(
      ChatEventType.ROOM_JOINED,
      {
        roomId: joinRoomDto.roomId,
        userId: payload.sub,
        joinedAt: new Date(),
      }
    );

    // 방 참여 알림을 해당 방의 모든 사용자에게 전송
    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `room.${joinRoomDto.roomId}`,
      {
        type: 'user_joined_room',
        userId: payload.sub,
        roomId: joinRoomDto.roomId,
        timestamp: new Date(),
      }
    );

    return {
      status: 'joined',
      roomId: joinRoomDto.roomId,
      subscription: `/exchange/chat.direct/room.${joinRoomDto.roomId}`
    };
  }

  // 방 나가기
  @Post('leave-room/:roomId')
  async leaveRoom(
    @Headers('authorization') authorization: string,
    @Param('roomId') roomId: number
  ) {
    const payload = await this.validateToken(authorization);
    
    await this.rabbitmqService.publishEvent(
      ChatEventType.ROOM_LEFT,
      {
        roomId: roomId,
        userId: payload.sub,
        leftAt: new Date(),
      }
    );

    // 방 나가기 알림
    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `room.${roomId}`,
      {
        type: 'user_left_room',
        userId: payload.sub,
        roomId: roomId,
        timestamp: new Date(),
      }
    );

    return { status: 'left', roomId: roomId };
  }

  // 메시지 전송
  @Post('send-message')
  async sendMessage(
    @Headers('authorization') authorization: string,
    @Body() messageData: { roomId: number; message: CreateMessageDto }
  ) {
    const payload = await this.validateToken(authorization);
    
    // 권한 확인
    const hasAccess = await this.chatService.canAccessRoom(messageData.roomId, payload.sub);
    if (!hasAccess) {
      throw new UnauthorizedException('메시지를 전송할 권한이 없습니다');
    }

    // 메시지 저장 (RabbitMQ를 통해 비동기 처리)
    const message = await this.chatService.createMessage(messageData.roomId, payload.sub, messageData.message);

    // RabbitMQ 이벤트 발행
    const messageEvent: ChatMessageSentEvent = {
      messageId: message.id,
      roomId: messageData.roomId,
      senderId: payload.sub,
      messageType: messageData.message.message_type,
      content: messageData.message.content,
      fileUrl: messageData.message.file_url,
      fileName: messageData.message.file_name,
      fileSize: messageData.message.file_size,
      sentAt: new Date(),
    };

    await this.rabbitmqService.publishEvent(ChatEventType.MESSAGE_SENT, messageEvent);

    // 방에 있는 모든 사용자에게 실시간 메시지 전송 (STOMP를 통해)
    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `room.${messageData.roomId}`,
      {
        type: 'new_message',
        message: message,
        timestamp: new Date(),
      }
    );

    return {
      status: 'sent',
      messageId: message.id,
      roomId: messageData.roomId
    };
  }

  // 타이핑 시작
  @Post('typing-start')
  async startTyping(
    @Headers('authorization') authorization: string,
    @Body() typingData: { roomId: number }
  ) {
    const payload = await this.validateToken(authorization);

    const typingEvent: ChatTypingEvent = {
      roomId: typingData.roomId,
      userId: payload.sub,
      userName: payload.email, // 또는 실제 사용자 이름
      isTyping: true,
      timestamp: new Date(),
    };

    await this.rabbitmqService.publishEvent(ChatEventType.TYPING_START, typingEvent);

    // 방에 있는 다른 사용자들에게만 전송
    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `room.${typingData.roomId}`,
      {
        type: 'user_typing',
        userId: payload.sub,
        isTyping: true,
        timestamp: new Date(),
      }
    );

    return { status: 'typing_started' };
  }

  // 타이핑 종료
  @Post('typing-end')
  async endTyping(
    @Headers('authorization') authorization: string,
    @Body() typingData: { roomId: number }
  ) {
    const payload = await this.validateToken(authorization);

    const typingEvent: ChatTypingEvent = {
      roomId: typingData.roomId,
      userId: payload.sub,
      userName: payload.email,
      isTyping: false,
      timestamp: new Date(),
    };

    await this.rabbitmqService.publishEvent(ChatEventType.TYPING_END, typingEvent);

    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `room.${typingData.roomId}`,
      {
        type: 'user_typing',
        userId: payload.sub,
        isTyping: false,
        timestamp: new Date(),
      }
    );

    return { status: 'typing_ended' };
  }

  // 메시지 읽음 처리
  @Post('mark-message-read')
  async markMessageRead(
    @Headers('authorization') authorization: string,
    @Body() readData: MarkMessageReadDto
  ) {
    const payload = await this.validateToken(authorization);
    
    await this.chatService.markMessageAsRead(readData.messageId, payload.sub);

    const readEvent: ChatMessageReadEvent = {
      messageId: readData.messageId,
      roomId: readData.roomId,
      readerId: payload.sub,
      readAt: new Date(),
    };

    await this.rabbitmqService.publishEvent(ChatEventType.MESSAGE_READ, readEvent);

    // 방에 있는 다른 사용자들에게 읽음 상태 전송
    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `room.${readData.roomId}`,
      {
        type: 'message_read',
        messageId: readData.messageId,
        readerId: payload.sub,
        readAt: new Date(),
      }
    );

    return { status: 'marked_as_read' };
  }

  // 온라인 사용자 목록 조회
  @Get('online-users/:roomId')
  async getOnlineUsers(
    @Headers('authorization') authorization: string,
    @Param('roomId') roomId: number
  ) {
    await this.validateToken(authorization);
    
    const onlineUsers = await this.redisService.setGetAll('online_users');
    const roomUsers = await this.chatService.getRoomUsers(roomId);
    
    // 해당 방에 속한 온라인 사용자만 필터링
    const onlineRoomUsers = roomUsers.filter(user => 
      onlineUsers.includes(user.id.toString())
    );

    return {
      onlineUsers: onlineRoomUsers,
      count: onlineRoomUsers.length
    };
  }

  // 특정 사용자에게 직접 메시지 전송하는 메소드 (외부 서비스용)
  async sendToUser(userId: number, event: string, data: any) {
    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `user.${userId}`,
      {
        type: event,
        data: data,
        timestamp: new Date(),
      }
    );
  }

  // 특정 방에 메시지 전송하는 메소드 (외부 서비스용)
  async sendToRoom(roomId: number, event: string, data: any) {
    await this.rabbitmqService.publishToExchange(
      'chat.direct',
      `room.${roomId}`,
      {
        type: event,
        data: data,
        timestamp: new Date(),
      }
    );
  }
}