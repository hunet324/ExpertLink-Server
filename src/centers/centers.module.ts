import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CentersController } from './centers.controller';
import { CentersService } from './centers.service';
import { Center } from '../entities/center.entity';
import { User } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Center, User, ExpertProfile])],
  controllers: [CentersController],
  providers: [CentersService],
  exports: [CentersService],
})
export class CentersModule {}