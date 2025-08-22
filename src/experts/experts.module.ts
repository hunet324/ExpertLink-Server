import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { User } from '../entities/user.entity';
import { Schedule } from '../entities/schedule.entity';
import { ExpertVacation } from '../entities/expert-vacation.entity';
import { ExpertsService } from './experts.service';
import { ExpertsController } from './experts.controller';
import { VacationService } from './vacation.service';
import { VacationController } from './vacation.controller';
import { SchedulesService } from '../schedules/schedules.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExpertProfile, User, Schedule, ExpertVacation])],
  providers: [ExpertsService, VacationService, SchedulesService],
  controllers: [ExpertsController, VacationController],
  exports: [ExpertsService, VacationService],
})
export class ExpertsModule {}