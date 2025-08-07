import { 
  Controller, 
  Get, 
  Put, 
  Param, 
  Query, 
  Body, 
  UseGuards, 
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe
} from '@nestjs/common';
import { ExpertsService } from './experts.service';
import { SchedulesService } from '../schedules/schedules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../common/guards/expert.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { ExpertSearchDto } from './dto/expert-search.dto';
import { ExpertListResponseDto, ExpertDetailResponseDto } from './dto/expert-response.dto';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { ScheduleResponseDto } from '../schedules/dto/schedule-response.dto';

@Controller('experts')
export class ExpertsController {
  constructor(
    private readonly expertsService: ExpertsService,
    private readonly schedulesService: SchedulesService,
  ) {}

  @Get()
  async searchExperts(@Query() searchDto: ExpertSearchDto): Promise<{
    experts: ExpertListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await this.expertsService.searchExperts(searchDto);
  }

  @Get(':id')
  async getExpertDetail(@Param('id', ParseIntPipe) id: number): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.getExpertDetail(id);
  }

  @Get(':id/schedules')
  async getExpertSchedules(@Param('id', ParseIntPipe) expertId: number): Promise<ScheduleResponseDto[]> {
    return await this.schedulesService.getAvailableSchedules(expertId);
  }

  // 전문가 전용 API들
  @Put('profile')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateExpertProfileDto,
  ): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.updateExpertProfile(req.user.userId, updateDto);
  }

  @Get('profile/me')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  async getMyProfile(@Req() req: AuthenticatedRequest): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.getExpertProfile(req.user.userId);
  }

  @Get('schedules/me')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  async getMySchedules(@Req() req: AuthenticatedRequest): Promise<ScheduleResponseDto[]> {
    return await this.schedulesService.getExpertSchedules(req.user.userId, req.user.userId);
  }
}