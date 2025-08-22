import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { Counseling } from '../entities/counseling.entity';
import { Content } from '../entities/content.entity';
import { PsychTest } from '../entities/psych-test.entity';
import { PsychResult } from '../entities/psych-result.entity';
import { Notification } from '../entities/notification.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ExpertProfile,
      Counseling,
      Content,
      PsychTest,
      PsychResult,
      Notification,
      ChatMessage,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
    NotificationsModule, // 알림 서비스 사용을 위해 import
    UsersModule, // UsersService 사용을 위해 import
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}