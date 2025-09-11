import { Expose, Type, Transform } from 'class-transformer';
import { MessageType } from '../../entities/chat-message.entity';

class SenderDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  profile_image: string;

  @Expose()
  user_type: string;
}

export class ChatMessageResponseDto {
  @Expose()
  id: number;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  roomId: number;

  @Expose()
  room_id: number;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  senderId: number;

  @Expose()
  sender_id: number;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  messageType: MessageType;

  @Expose()
  message_type: MessageType;

  @Expose()
  content: string;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  fileUrl?: string;

  @Expose()
  file_url?: string;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  fileName?: string;

  @Expose()
  file_name?: string;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  fileSize?: number;

  @Expose()
  file_size?: number;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  isRead: boolean;

  @Expose()
  is_read: boolean;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  readAt?: Date;

  @Expose()
  read_at?: Date;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  isEdited: boolean;

  @Expose()
  is_edited: boolean;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  editedAt?: Date;

  @Expose()
  edited_at?: Date;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  createdAt: Date;

  @Expose()
  created_at: Date;

  @Expose()
  @Transform(({ value }) => value, { toPlainOnly: true })
  senderName?: string;

  // 발신자 정보
  @Expose()
  @Type(() => SenderDto)
  sender?: SenderDto;
}