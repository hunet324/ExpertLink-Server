import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationListResponseDto, NotificationStatsDto } from './dto/notification-response.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { MarkAsReadResponseDto, DeleteNotificationResponseDto, BulkActionDto, BulkActionResponseDto } from './dto/notification-action.dto';

interface RequestWithUser {
  user: {
    userId: number;
    email: string;
    userType: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard) // 모든 알림 API는 로그인 필수
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Query() query: NotificationQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<NotificationListResponseDto> {
    const userId = req.user.userId;
    return await this.notificationsService.getNotifications(userId, query);
  }

  @Get('stats')
  async getNotificationStats(@Req() req: RequestWithUser): Promise<NotificationStatsDto> {
    const userId = req.user.userId;
    return await this.notificationsService.getNotificationStats(userId);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<MarkAsReadResponseDto> {
    const userId = req.user.userId;
    return await this.notificationsService.markAsRead(id, userId);
  }

  @Delete(':id')
  async deleteNotification(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<DeleteNotificationResponseDto> {
    const userId = req.user.userId;
    return await this.notificationsService.deleteNotification(id, userId);
  }

  @Post('bulk-action')
  @HttpCode(HttpStatus.OK)
  async bulkAction(
    @Body() bulkActionDto: BulkActionDto,
    @Req() req: RequestWithUser,
  ): Promise<BulkActionResponseDto> {
    const userId = req.user.userId;
    return await this.notificationsService.bulkAction(userId, bulkActionDto);
  }
}