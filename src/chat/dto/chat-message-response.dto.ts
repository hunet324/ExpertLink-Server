import { Expose, Type } from 'class-transformer';
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
  room_id: number;

  @Expose()
  sender_id: number;

  @Expose()
  message_type: MessageType;

  @Expose()
  content: string;

  @Expose()
  file_url: string;

  @Expose()
  file_name: string;

  @Expose()
  file_size: number;

  @Expose()
  is_read: boolean;

  @Expose()
  read_at: Date;

  @Expose()
  is_edited: boolean;

  @Expose()
  edited_at: Date;

  @Expose()
  created_at: Date;

  // 발신자 정보
  @Expose()
  @Type(() => SenderDto)
  sender: SenderDto;
}