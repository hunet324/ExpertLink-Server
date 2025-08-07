import { IsString, IsOptional } from 'class-validator';

export class MarkAsReadResponseDto {
  message: string;
  is_read: boolean;
  updated_at: Date;
}

export class DeleteNotificationResponseDto {
  message: string;
  deleted_id: number;
}

export class BulkActionDto {
  @IsString()
  action: 'read' | 'delete'; // 'read' 또는 'delete'

  @IsOptional()
  notification_ids?: number[]; // 특정 알림들 (없으면 전체)
}

export class BulkActionResponseDto {
  message: string;
  affected_count: number;
  action: string;
}