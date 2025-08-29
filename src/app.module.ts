import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './config/redis.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExpertsModule } from './experts/experts.module';
import { SchedulesModule } from './schedules/schedules.module';
import { CounselingsModule } from './counselings/counselings.module';
import { ChatModule } from './chat/chat.module';
import { ContentsModule } from './contents/contents.module';
import { PsychTestsModule } from './psych-tests/psych-tests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { CentersModule } from './centers/centers.module';
import { CommonModule } from './common/common.module';
import { RabbitMQService } from './common/rabbitmq/rabbitmq.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD || undefined,
      database: process.env.DATABASE_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
    }),
    AuthModule,
    UsersModule,
    ExpertsModule,
    SchedulesModule,
    CounselingsModule,
    ChatModule,
    ContentsModule,
    PsychTestsModule,
    NotificationsModule,
    AdminModule,
    CentersModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisService, RabbitMQService],
})
export class AppModule {}