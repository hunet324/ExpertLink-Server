import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatRoom } from '../entities/chat-room.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { User } from '../entities/user.entity';
import { Counseling } from '../entities/counseling.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { ChatConsumer } from '../common/rabbitmq/chat.consumer';
import { RedisService } from '../config/redis.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatMessage, User, Counseling]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    ChatService, 
    ChatGateway, 
    RabbitMQService, 
    ChatConsumer, 
    RedisService
  ],
  controllers: [ChatController],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}