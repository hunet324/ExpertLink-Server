import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { User } from '../entities/user.entity';
import { Counseling } from '../entities/counseling.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Counseling])
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}