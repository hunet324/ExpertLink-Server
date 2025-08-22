import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Content } from '../entities/content.entity';
import { ContentLike } from '../entities/content-like.entity';
import { ContentBookmark } from '../entities/content-bookmark.entity';
import { ContentsService } from './contents.service';
import { ContentsController } from './contents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, ContentLike, ContentBookmark]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ContentsService],
  controllers: [ContentsController],
  exports: [ContentsService],
})
export class ContentsModule {}