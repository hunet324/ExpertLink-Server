import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete,
  Param, 
  Body, 
  UseGuards, 
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../common/guards/expert.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';

@ApiTags('📅 schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard, ExpertGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(
    @Req() req: AuthenticatedRequest,
    @Body() createDto: CreateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    return await this.schedulesService.createSchedule(req.user.userId, createDto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    return await this.schedulesService.updateSchedule(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return await this.schedulesService.deleteSchedule(id, req.user.userId);
  }
}