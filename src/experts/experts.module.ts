import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { User } from '../entities/user.entity';
import { Schedule } from '../entities/schedule.entity';
import { ExpertsService } from './experts.service';
import { ExpertsController } from './experts.controller';
import { SchedulesService } from '../schedules/schedules.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExpertProfile, User, Schedule])],
  providers: [ExpertsService, SchedulesService],
  controllers: [ExpertsController],
  exports: [ExpertsService],
})
export class ExpertsModule {}