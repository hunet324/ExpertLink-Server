import { Expose, Transform, Type } from 'class-transformer';
import { ChatRoomStatus } from '../../entities/chat-room.entity';

class ParticipantDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  profile_image: string;

  @Expose()
  user_type: string;

  @Expose()
  is_online: boolean;
}

class LastMessageDto {
  @Expose()
  id: number;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  senderId: number;

  @Expose()
  sender_id: number;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  senderName?: string;

  @Expose()
  sender_name?: string;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  messageType: string;

  @Expose()
  message_type: string;

  @Expose()
  content: string;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  createdAt: Date;

  @Expose()
  created_at: Date;
}

export class ChatRoomResponseDto {
  @Expose()
  id: number;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  counselingId?: number;

  @Expose()
  @Transform(({ obj }) => obj.counseling_id, { toPlainOnly: true })
  counseling_id?: number;

  @Expose()
  participants: number[];

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  roomName?: string;

  @Expose()
  @Transform(({ obj }) => obj.room_name, { toPlainOnly: true })
  room_name?: string;

  @Expose()
  status: ChatRoomStatus;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  lastMessageAt?: Date;

  @Expose()
  @Transform(({ obj }) => obj.last_message_at, { toPlainOnly: true })
  last_message_at?: Date;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  createdAt: Date;

  @Expose()
  @Transform(({ obj }) => obj.created_at, { toPlainOnly: true })
  created_at: Date;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  updatedAt: Date;

  @Expose()
  @Transform(({ obj }) => obj.updated_at, { toPlainOnly: true })
  updated_at: Date;

  // 참여자 정보
  @Expose()
  @Type(() => ParticipantDto)
  participant_details?: ParticipantDto[];

  // 마지막 메시지 정보
  @Expose()
  @Type(() => LastMessageDto)
  @Transform(({ value }) => value, { toPlainOnly: true })
  lastMessage?: LastMessageDto;

  @Expose()
  @Type(() => LastMessageDto)
  last_message?: LastMessageDto;

  // 읽지 않은 메시지 수
  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  unreadCount?: number;

  @Expose()
  unread_count?: number;
}
