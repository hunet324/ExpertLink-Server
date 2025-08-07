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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ExpertsService } from './experts.service';
import { SchedulesService } from '../schedules/schedules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../common/guards/expert.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { ExpertSearchDto } from './dto/expert-search.dto';
import { ExpertListResponseDto, ExpertDetailResponseDto } from './dto/expert-response.dto';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { ScheduleResponseDto } from '../schedules/dto/schedule-response.dto';

@ApiTags('experts')
@Controller('experts')
export class ExpertsController {
  constructor(
    private readonly expertsService: ExpertsService,
    private readonly schedulesService: SchedulesService,
  ) {}

  @Get()
  @ApiOperation({ summary: '전문가 검색', description: '조건에 따라 전문가를 검색합니다.' })
  @ApiResponse({ status: 200, description: '전문가 목록 조회 성공' })
  async searchExperts(@Query() searchDto: ExpertSearchDto): Promise<{
    experts: ExpertListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await this.expertsService.searchExperts(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '전문가 상세 조회', description: '특정 전문가의 상세 정보를 조회합니다.' })
  @ApiParam({ name: 'id', description: '전문가 ID', type: Number })
  @ApiResponse({ status: 200, description: '전문가 상세 정보 조회 성공', type: ExpertDetailResponseDto })
  @ApiResponse({ status: 404, description: '전문가를 찾을 수 없습니다.' })
  async getExpertDetail(@Param('id', ParseIntPipe) id: number): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.getExpertDetail(id);
  }

  @Get(':id/schedules')
  @ApiOperation({ summary: '전문가 일정 조회', description: '특정 전문가의 예약 가능한 일정을 조회합니다.' })
  @ApiParam({ name: 'id', description: '전문가 ID', type: Number })
  @ApiResponse({ status: 200, description: '전문가 일정 조회 성공', type: [ScheduleResponseDto] })
  @ApiResponse({ status: 404, description: '전문가를 찾을 수 없습니다.' })
  async getExpertSchedules(@Param('id', ParseIntPipe) expertId: number): Promise<ScheduleResponseDto[]> {
    return await this.schedulesService.getAvailableSchedules(expertId);
  }

  // 전문가 전용 API들
  @Put('profile')
  @ApiOperation({ summary: '전문가 프로필 수정', description: '전문가가 자신의 프로필을 수정합니다.' })
  @ApiResponse({ status: 200, description: '프로필 수정 성공', type: ExpertDetailResponseDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '전문가 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateExpertProfileDto,
  ): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.updateExpertProfile(req.user.userId, updateDto);
  }

  @Get('profile/me')
  @ApiOperation({ summary: '내 프로필 조회', description: '전문가가 자신의 프로필을 조회합니다.' })
  @ApiResponse({ status: 200, description: '프로필 조회 성공', type: ExpertDetailResponseDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '전문가 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  async getMyProfile(@Req() req: AuthenticatedRequest): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.getExpertProfile(req.user.userId);
  }

  @Get('schedules/me')
  @ApiOperation({ summary: '내 일정 조회', description: '전문가가 자신의 일정을 조회합니다.' })
  @ApiResponse({ status: 200, description: '일정 조회 성공', type: [ScheduleResponseDto] })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '전문가 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  async getMySchedules(@Req() req: AuthenticatedRequest): Promise<ScheduleResponseDto[]> {
    return await this.schedulesService.getExpertSchedules(req.user.userId, req.user.userId);
  }
}