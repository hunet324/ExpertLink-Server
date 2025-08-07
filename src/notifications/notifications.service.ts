import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { NotificationDto, NotificationListResponseDto, NotificationStatsDto } from './dto/notification-response.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { MarkAsReadResponseDto, DeleteNotificationResponseDto, BulkActionDto, BulkActionResponseDto } from './dto/notification-action.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async getNotifications(
    userId: number,
    query: NotificationQueryDto,
  ): Promise<NotificationListResponseDto> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .orderBy('notification.created_at', 'DESC');

    // 필터링 적용
    this.applyFilters(queryBuilder, query);

    // 전체 개수 조회
    const total = await queryBuilder.getCount();

    // 읽지 않은 알림 수 조회
    const unreadCount = await this.notificationRepository.count({
      where: { user_id: userId, is_read: false },
    });

    // 페이지네이션 적용하여 알림 조회
    const notifications = await queryBuilder
      .skip(query.offset)
      .take(query.limit)
      .getMany();

    // 상대적 시간 추가
    const notificationsWithTimeAgo = notifications.map(notification => {
      const dto = plainToClass(NotificationDto, notification, { excludeExtraneousValues: true });
      dto.time_ago = this.getTimeAgo(notification.created_at);
      return dto;
    });

    const totalPages = Math.ceil(total / query.limit);

    return {
      notifications: notificationsWithTimeAgo,
      total,
      unread_count: unreadCount,
      page: query.page,
      limit: query.limit,
      total_pages: totalPages,
    };
  }

  async getNotificationStats(userId: number): Promise<NotificationStatsDto> {
    const [totalCount, unreadCount, todayCount] = await Promise.all([
      // 전체 알림 수
      this.notificationRepository.count({
        where: { user_id: userId },
      }),
      // 읽지 않은 알림 수
      this.notificationRepository.count({
        where: { user_id: userId, is_read: false },
      }),
      // 오늘 받은 알림 수
      this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.user_id = :userId', { userId })
        .andWhere('DATE(notification.created_at) = CURRENT_DATE')
        .getCount(),
    ]);

    return {
      total_count: totalCount,
      unread_count: unreadCount,
      read_count: totalCount - unreadCount,
      today_count: todayCount,
    };
  }

  async markAsRead(notificationId: number, userId: number): Promise<MarkAsReadResponseDto> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user_id: userId },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    if (notification.is_read) {
      return {
        message: '이미 읽은 알림입니다.',
        is_read: true,
        updated_at: notification.created_at, // 업데이트가 없으므로 원래 시간 반환
      };
    }

    notification.is_read = true;
    const updatedNotification = await this.notificationRepository.save(notification);

    return {
      message: '알림을 읽음으로 처리했습니다.',
      is_read: true,
      updated_at: new Date(),
    };
  }

  async deleteNotification(notificationId: number, userId: number): Promise<DeleteNotificationResponseDto> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user_id: userId },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    await this.notificationRepository.remove(notification);

    return {
      message: '알림이 삭제되었습니다.',
      deleted_id: notificationId,
    };
  }

  async bulkAction(userId: number, bulkActionDto: BulkActionDto): Promise<BulkActionResponseDto> {
    let affectedCount = 0;

    if (bulkActionDto.action === 'read') {
      // 모든 알림을 읽음으로 처리 또는 특정 알림들
      const whereCondition = bulkActionDto.notification_ids 
        ? { user_id: userId, id: bulkActionDto.notification_ids as any, is_read: false }
        : { user_id: userId, is_read: false };

      const result = await this.notificationRepository.update(whereCondition, { is_read: true });
      affectedCount = result.affected || 0;

      return {
        message: `${affectedCount}개의 알림을 읽음으로 처리했습니다.`,
        affected_count: affectedCount,
        action: 'read',
      };
    } else if (bulkActionDto.action === 'delete') {
      // 모든 알림 삭제 또는 특정 알림들
      const whereCondition = bulkActionDto.notification_ids
        ? { user_id: userId, id: bulkActionDto.notification_ids as any }
        : { user_id: userId };

      const result = await this.notificationRepository.delete(whereCondition);
      affectedCount = result.affected || 0;

      return {
        message: `${affectedCount}개의 알림이 삭제되었습니다.`,
        affected_count: affectedCount,
        action: 'delete',
      };
    }

    throw new ForbiddenException('지원하지 않는 액션입니다.');
  }

  // 알림 생성 메소드 (다른 서비스에서 호출)
  async createNotification(
    userId: number,
    title: string,
    message: string,
    type?: NotificationType,
    referenceId?: number,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user_id: userId,
      title,
      message,
      type,
      reference_id: referenceId,
      metadata,
    });

    return await this.notificationRepository.save(notification);
  }

  // 여러 사용자에게 알림 전송 (시스템 알림 등)
  async createBulkNotifications(
    userIds: number[],
    title: string,
    message: string,
    type?: NotificationType,
    metadata?: Record<string, any>,
  ): Promise<Notification[]> {
    const notifications = userIds.map(userId =>
      this.notificationRepository.create({
        user_id: userId,
        title,
        message,
        type,
        metadata,
      })
    );

    return await this.notificationRepository.save(notifications);
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Notification>, query: NotificationQueryDto) {
    if (query.type) {
      queryBuilder.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.is_read !== undefined) {
      queryBuilder.andWhere('notification.is_read = :isRead', { isRead: query.is_read });
    }
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}분 전`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}시간 전`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}일 전`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months}개월 전`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years}년 전`;
    }
  }
}