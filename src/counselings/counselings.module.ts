import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Counseling } from '../entities/counseling.entity';
import { User } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { CounselingsService } from './counselings.service';
import { CounselingsController } from './counselings.controller';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { CounselingConsumer } from '../common/rabbitmq/counseling.consumer';
import { RedisService } from '../config/redis.config';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Counseling, 
      User, 
      ExpertProfile
    ]),
    forwardRef(() => ChatModule),
    NotificationsModule,
  ],
  providers: [
    CounselingsService, 
    RabbitMQService, 
    CounselingConsumer, 
    RedisService
  ],
  controllers: [
    CounselingsController
  ],
  exports: [CounselingsService],
})
export class CounselingsModule {}