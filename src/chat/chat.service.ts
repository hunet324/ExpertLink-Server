import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom, ChatRoomStatus } from '../entities/chat-room.entity';
import { ChatMessage, MessageType } from '../entities/chat-message.entity';
import { User } from '../entities/user.entity';
import { Counseling, CounselingStatus } from '../entities/counseling.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatRoomResponseDto } from './dto/chat-room-response.dto';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { RedisService } from '../config/redis.config';
import { ChatEventType, ChatRoomCreatedEvent } from '../common/events/chat.events';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Counseling)
    private counselingRepository: Repository<Counseling>,
    private readonly rabbitmqService: RabbitMQService,
    private readonly redisService: RedisService,
  ) {}

  async getUserChatRooms(userId: number): Promise<ChatRoomResponseDto[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const rooms = await this.chatRoomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.counseling', 'counseling')
      .leftJoin('room.messages', 'lastMessage')
      .addSelect('lastMessage.id', 'lastMessageId')
      .addSelect('lastMessage.sender_id', 'lastMessageSenderId')
      .addSelect('lastMessage.content', 'lastMessageContent')
      .addSelect('lastMessage.message_type', 'lastMessageType')
      .addSelect('lastMessage.created_at', 'lastMessageCreatedAt')
      .where(':userId = ANY(room.participants)', { userId })
      .andWhere('room.status = :status', { status: ChatRoomStatus.ACTIVE })
      .orderBy('room.last_message_at', 'DESC')
      .getMany();

    const roomDtos = await Promise.all(
      rooms.map(async (room) => {
        const dto = plainToClass(ChatRoomResponseDto, room, {
          excludeExtraneousValues: true,
        });

        // 참여자 상세 정보 조회
        const participants = await this.userRepository
          .createQueryBuilder('user')
          .where('user.id IN (:...ids)', { ids: room.participants })
          .getMany();

        dto.participant_details = await Promise.all(
          participants.map(async (participant) => ({
            id: participant.id,
            name: participant.name,
            profile_image: participant.profile_image,
            user_type: participant.user_type,
            is_online: await this.isUserOnline(participant.id),
          }))
        );

        // 읽지 않은 메시지 수 조회
        dto.unread_count = await this.getUnreadCount(userId, room.id);

        return dto;
      })
    );

    return roomDtos;
  }

  async getChatRoomMessages(
    roomId: number,
    userId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: ChatMessageResponseDto[]; total: number; hasMore: boolean }> {
    // 접근 권한 확인
    const canAccess = await this.canAccessRoom(roomId, userId);
    if (!canAccess) {
      throw new ForbiddenException('채팅방에 접근할 권한이 없습니다.');
    }

    const [messages, total] = await this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.room_id = :roomId', { roomId })
      .orderBy('message.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const messageDtos = messages
      .reverse() // 시간순 정렬
      .map((message) =>
        plainToClass(ChatMessageResponseDto, message, {
          excludeExtraneousValues: true,
        })
      );

    return {
      messages: messageDtos,
      total,
      hasMore: total > page * limit,
    };
  }

  async createMessage(
    roomId: number,
    senderId: number,
    createMessageDto: CreateMessageDto
  ): Promise<ChatMessageResponseDto> {
    // 접근 권한 확인
    const canAccess = await this.canAccessRoom(roomId, senderId);
    if (!canAccess) {
      throw new ForbiddenException('메시지를 전송할 권한이 없습니다.');
    }

    // 채팅방 존재 확인
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, status: ChatRoomStatus.ACTIVE }
    });

    if (!room) {
      throw new NotFoundException('활성화된 채팅방을 찾을 수 없습니다.');
    }

    // 메시지 생성
    const message = this.chatMessageRepository.create({
      room_id: roomId,
      sender_id: senderId,
      message_type: createMessageDto.message_type,
      content: createMessageDto.content,
      file_url: createMessageDto.file_url,
      file_name: createMessageDto.file_name,
      file_size: createMessageDto.file_size,
    });

    const savedMessage = await this.chatMessageRepository.save(message);

    // 관계된 데이터와 함께 메시지 조회
    const messageWithRelations = await this.chatMessageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.id = :id', { id: savedMessage.id })
      .getOne();

    return plainToClass(ChatMessageResponseDto, messageWithRelations, {
      excludeExtraneousValues: true,
    });
  }

  async markMessageAsRead(messageId: number, readerId: number): Promise<void> {
    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId }
    });

    if (!message) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }

    // 접근 권한 확인
    const canAccess = await this.canAccessRoom(message.room_id, readerId);
    if (!canAccess) {
      throw new ForbiddenException('메시지를 읽을 권한이 없습니다.');
    }

    // 이미 읽음 처리된 경우 무시
    if (message.is_read) {
      return;
    }

    await this.chatMessageRepository.update(messageId, {
      is_read: true,
      read_at: new Date(),
    });
  }

  async canAccessRoom(roomId: number, userId: number): Promise<boolean> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId }
    });

    if (!room) {
      return false;
    }

    return room.participants.includes(userId);
  }

  async createChatRoomFromCounseling(counselingId: number): Promise<ChatRoomResponseDto> {
    const counseling = await this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .where('counseling.id = :id', { id: counselingId })
      .andWhere('counseling.status = :status', { status: CounselingStatus.APPROVED })
      .getOne();

    if (!counseling) {
      throw new NotFoundException('승인된 상담을 찾을 수 없습니다.');
    }

    // 이미 채팅방이 존재하는지 확인
    const existingRoom = await this.chatRoomRepository.findOne({
      where: { counseling_id: counselingId }
    });

    if (existingRoom) {
      return plainToClass(ChatRoomResponseDto, existingRoom, {
        excludeExtraneousValues: true,
      });
    }

    // 새 채팅방 생성
    const room = this.chatRoomRepository.create({
      counseling_id: counselingId,
      participants: [counseling.user_id, counseling.expert_id],
      room_name: `${counseling.user.name} - ${counseling.expert.name} 상담`,
      status: ChatRoomStatus.ACTIVE,
    });

    const savedRoom = await this.chatRoomRepository.save(room);

    // 시스템 메시지 생성
    const systemMessage = this.chatMessageRepository.create({
      room_id: savedRoom.id,
      sender_id: null,
      message_type: MessageType.SYSTEM,
      content: `${counseling.user.name}님과 ${counseling.expert.name} 전문가의 상담이 시작되었습니다.`,
    });

    await this.chatMessageRepository.save(systemMessage);

    // RabbitMQ 이벤트 발행
    const roomCreatedEvent: ChatRoomCreatedEvent = {
      roomId: savedRoom.id,
      counselingId: counselingId,
      participants: savedRoom.participants,
      roomName: savedRoom.room_name,
      createdAt: savedRoom.created_at,
    };

    await this.rabbitmqService.publishEvent(ChatEventType.ROOM_CREATED, roomCreatedEvent);

    return plainToClass(ChatRoomResponseDto, savedRoom, {
      excludeExtraneousValues: true,
    });
  }

  private async getUnreadCount(userId: number, roomId: number): Promise<number> {
    const count = await this.redisService.get(`unread_count:${userId}:${roomId}`);
    return count ? parseInt(count) : 0;
  }

  private async isUserOnline(userId: number): Promise<boolean> {
    const onlineUsers = await this.redisService.setMembers('online_users');
    return onlineUsers.includes(userId.toString());
  }

  async getRoomUsers(roomId: number): Promise<User[]> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      select: ['participants']
    });

    if (!room || !room.participants) {
      return [];
    }

    // participants 배열에서 사용자 ID들을 추출하여 User 정보 조회
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = ANY(:userIds)', { userIds: room.participants })
      .select(['user.id', 'user.name', 'user.email'])
      .getMany();

    return users;
  }
}