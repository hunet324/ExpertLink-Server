import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification } from '../entities/notification.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationTemplateService } from './notification-template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationTemplate]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [NotificationsService, NotificationTemplateService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationTemplateService], // 다른 서비스에서 알림 생성을 위해 export
})
export class NotificationsModule {}