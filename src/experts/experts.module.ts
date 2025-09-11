import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { User } from '../entities/user.entity';
import { ExpertVacation } from '../entities/expert-vacation.entity';
import { Counseling } from '../entities/counseling.entity';
import { ExpertsService } from './experts.service';
import { ExpertsController } from './experts.controller';
import { VacationService } from './vacation.service';
import { VacationController } from './vacation.controller';
import { CounselingsModule } from '../counselings/counselings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpertProfile, User, ExpertVacation, Counseling]),
    NotificationsModule,
    CommonModule,
    CounselingsModule
  ],
  providers: [ExpertsService, VacationService],
  controllers: [VacationController, ExpertsController],
  exports: [ExpertsService, VacationService],
})
export class ExpertsModule {}