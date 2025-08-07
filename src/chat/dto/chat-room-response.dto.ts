import { Expose, Transform, Type } from 'class-transformer';
import { ChatRoomStatus } from '../../entities/chat-room.entity';

export class ChatRoomResponseDto {
  @Expose()
  id: number;

  @Expose()
  counseling_id: number;

  @Expose()
  participants: number[];

  @Expose()
  room_name: string;

  @Expose()
  status: ChatRoomStatus;

  @Expose()
  last_message_at: Date;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  // 참여자 정보
  @Expose()
  @Type(() => ParticipantDto)
  participant_details: ParticipantDto[];

  // 마지막 메시지 정보
  @Expose()
  @Type(() => LastMessageDto)
  last_message: LastMessageDto;

  // 읽지 않은 메시지 수
  @Expose()
  unread_count: number;
}

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
  sender_id: number;

  @Expose()
  sender_name: string;

  @Expose()
  message_type: string;

  @Expose()
  content: string;

  @Expose()
  created_at: Date;
}