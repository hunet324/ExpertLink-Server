import { Expose, Type } from 'class-transformer';
import { NotificationType } from '../../entities/notification.entity';

export class NotificationDto {
  @Expose()
  id: number;

  @Expose()
  title?: string;

  @Expose()
  message: string;

  @Expose()
  type?: NotificationType;

  @Expose()
  reference_id?: number;

  @Expose()
  is_read: boolean;

  @Expose()
  metadata?: Record<string, any>;

  @Expose()
  @Type(() => Date)
  created_at: Date;

  // 상대적 시간 계산 (예: "2분 전", "1시간 전")
  @Expose()
  time_ago?: string;
}

export class NotificationListResponseDto {
  @Expose()
  @Type(() => NotificationDto)
  notifications: NotificationDto[];

  @Expose()
  total: number;

  @Expose()
  unread_count: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  total_pages: number;
}

export class NotificationStatsDto {
  @Expose()
  total_count: number;

  @Expose()
  unread_count: number;

  @Expose()
  read_count: number;

  @Expose()
  today_count: number;
}