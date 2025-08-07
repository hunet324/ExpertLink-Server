import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PsychTest } from '../entities/psych-test.entity';
import { PsychQuestion } from '../entities/psych-question.entity';
import { PsychAnswer } from '../entities/psych-answer.entity';
import { PsychResult } from '../entities/psych-result.entity';
import { PsychTestsService } from './psych-tests.service';
import { PsychTestsController, UsersPsychResultsController } from './psych-tests.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PsychTest, PsychQuestion, PsychAnswer, PsychResult]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PsychTestsService],
  controllers: [PsychTestsController, UsersPsychResultsController],
  exports: [PsychTestsService],
})
export class PsychTestsModule {}