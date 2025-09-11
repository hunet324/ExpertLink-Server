import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Param, 
  Body, 
  Query,
  UseGuards, 
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CounselingsService } from './counselings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../common/guards/expert.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { CreateCounselingDto } from './dto/create-counseling.dto';
import { CreateAvailableSlotsDto } from './dto/create-available-slot.dto';
import { BookSlotDto } from './dto/book-slot.dto';
import { UpdateCounselingStatusDto } from './dto/update-counseling-status.dto';
import { CounselingResponseDto } from './dto/counseling-response.dto';
import { plainToClass } from 'class-transformer';

@ApiTags('🗣️ counselings')
@Controller('counselings')
export class CounselingsController {
  constructor(
    private readonly counselingsService: CounselingsService,
  ) {}

  // ===== 가용 슬롯 관리 (전문가) =====
  
  @Post('slots')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiOperation({ summary: '전문가가 상담 가능한 시간대 등록' })
  @ApiResponse({ type: [CounselingResponseDto] })
  async createAvailableSlots(
    @Req() req: AuthenticatedRequest,
    @Body() createDto: CreateAvailableSlotsDto,
  ): Promise<CounselingResponseDto[]> {
    const slots = await this.counselingsService.createAvailableSlots(req.user.userId, createDto.slots);
    return slots.map(slot => 
      plainToClass(CounselingResponseDto, slot, { excludeExtraneousValues: true })
    );
  }

  @Get('slots/available/:expertId')
  @ApiOperation({ summary: '특정 전문가의 예약 가능한 슬롯 조회' })
  @ApiResponse({ type: [CounselingResponseDto] })
  async getAvailableSlots(
    @Param('expertId', ParseIntPipe) expertId: number,
    @Query('date') date?: string,
  ): Promise<CounselingResponseDto[]> {
    return await this.counselingsService.getAvailableSlots(expertId, date);
  }

  // ===== 상담 예약 =====
  
  @Post('slots/:slotId/book')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '가용 슬롯 예약' })
  @ApiResponse({ type: CounselingResponseDto })
  async bookSlot(
    @Param('slotId', ParseIntPipe) slotId: number,
    @Req() req: AuthenticatedRequest,
    @Body() bookDto: BookSlotDto,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.bookSlot(slotId, req.user.userId, bookDto);
  }
  
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '상담 요청 생성 (레거시 호환)' })
  async createCounselingRequest(
    @Req() req: AuthenticatedRequest,
    @Body() createDto: CreateCounselingDto,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.createCounselingRequest(req.user.userId, createDto);
  }

  // ===== 통합 일정 조회 (counseling-unified 기능 통합) =====
  
  @Get('expert/all')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiOperation({ summary: '전문가 전체 일정 조회' })
  @ApiResponse({ type: [CounselingResponseDto] })
  async getExpertAllSchedules(@Req() req: AuthenticatedRequest): Promise<CounselingResponseDto[]> {
    const schedules = await this.counselingsService.getExpertAllSchedules(req.user.userId);
    return schedules.map(schedule => 
      plainToClass(CounselingResponseDto, schedule, { excludeExtraneousValues: true })
    );
  }

  @Get('expert/today')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiOperation({ summary: '전문가 오늘 일정 조회' })
  @ApiResponse({ type: [CounselingResponseDto] })
  async getExpertTodaySchedules(@Req() req: AuthenticatedRequest): Promise<CounselingResponseDto[]> {
    const schedules = await this.counselingsService.getExpertTodaySchedules(req.user.userId);
    return schedules.map(schedule => 
      plainToClass(CounselingResponseDto, schedule, { excludeExtraneousValues: true })
    );
  }
  
  // ===== 기존 기능 유지 =====
  
  @Get('requests')
  @UseGuards(JwtAuthGuard)
  async getNewRequestsForExpert(@Req() req: AuthenticatedRequest): Promise<CounselingResponseDto[]> {
    return await this.counselingsService.getNewRequestsForExpert(req.user.userId);
  }

  @Get('requests/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingRequestsForDashboard(@Req() req: AuthenticatedRequest): Promise<CounselingResponseDto[]> {
    return await this.counselingsService.getPendingRequestsForDashboard(req.user.userId);
  }

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard)
  async getDashboardStats(@Req() req: AuthenticatedRequest): Promise<any> {
    return await this.counselingsService.getExpertDashboardStats(req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyCounselings(@Req() req: AuthenticatedRequest): Promise<CounselingResponseDto[]> {
    return await this.counselingsService.getMyCounselings(req.user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getCounselingDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.getCounselingDetail(id, req.user.userId);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateCounselingStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateCounselingStatusDto,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.updateCounselingStatus(id, req.user.userId, updateDto);
  }

  @Put(':id/approve-schedule')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async approveScheduleProposal(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.approveScheduleProposal(id, req.user.userId);
  }

  @Put(':id/reject-schedule')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async rejectScheduleProposal(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() body?: { rejectionReason?: string },
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.rejectScheduleProposal(id, req.user.userId, body?.rejectionReason);
  }

  @Get('expert/chat/active-upcoming')
  @UseGuards(JwtAuthGuard)
  async getExpertActiveAndUpcomingChats(@Req() req: AuthenticatedRequest): Promise<any[]> {
    return await this.counselingsService.getExpertActiveAndUpcomingChats(req.user.userId);
  }

  @Get('expert/chat/completed')
  @UseGuards(JwtAuthGuard)
  async getExpertCompletedChats(@Req() req: AuthenticatedRequest): Promise<any[]> {
    return await this.counselingsService.getExpertCompletedChats(req.user.userId);
  }

  @Get('expert/video/active-upcoming')
  @UseGuards(JwtAuthGuard)
  async getExpertActiveAndUpcomingVideos(@Req() req: AuthenticatedRequest): Promise<any[]> {
    return await this.counselingsService.getExpertActiveAndUpcomingVideos(req.user.userId);
  }

  @Get('expert/video/completed')
  @UseGuards(JwtAuthGuard)
  async getExpertCompletedVideos(@Req() req: AuthenticatedRequest): Promise<any[]> {
    return await this.counselingsService.getExpertCompletedVideos(req.user.userId);
  }
}
