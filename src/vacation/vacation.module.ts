import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertVacation } from '../entities/expert-vacation.entity';
import { VacationService } from '../experts/vacation.service';
import { VacationController } from '../experts/vacation.controller';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExpertVacation, User])],
  providers: [VacationService],
  controllers: [VacationController],
  exports: [VacationService],
})
export class VacationModule {}