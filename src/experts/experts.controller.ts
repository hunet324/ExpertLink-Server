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

@ApiTags('👨‍⚕️ experts')
@Controller('experts')
export class ExpertsController {
  constructor(
    private readonly expertsService: ExpertsService,
    private readonly schedulesService: SchedulesService,
  ) {}

  @Get()
  @ApiOperation({ 
    summary: '🔍 전문가 검색', 
    description: `전문가를 다양한 조건으로 검색합니다.
    
**검색 가능한 조건:**
- 전문 분야 (specialization)
- 경력 년수 (experience)
- 지역 (location)
- 평점 (rating)
- 이름 (name)
- 페이지네이션 지원` 
  })
  @ApiQuery({ 
    name: 'specialization', 
    required: false, 
    description: '전문 분야 (예: 우울증, 불안장애, 부부상담)', 
    example: '우울증' 
  })
  @ApiQuery({ 
    name: 'location', 
    required: false, 
    description: '지역', 
    example: '서울' 
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: '페이지 번호 (기본값: 1)', 
    example: 1 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: '페이지당 결과 수 (기본값: 10)', 
    example: 10 
  })
  @ApiResponse({ 
    status: 200, 
    description: '전문가 목록 조회 성공',
    schema: {
      example: {
        experts: [
          {
            id: 1,
            name: '김상담',
            specialization: ['우울증', '불안장애'],
            rating: 4.8,
            reviewCount: 156,
            location: '서울',
            profileImage: '/uploads/profiles/expert1.jpg'
          }
        ],
        total: 25,
        page: 1,
        totalPages: 3
      }
    }
  })
  async searchExperts(@Query() searchDto: ExpertSearchDto): Promise<{
    experts: ExpertListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await this.expertsService.searchExperts(searchDto);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: '👨‍⚕️ 전문가 상세 조회', 
    description: '특정 전문가의 상세 정보를 조회합니다. 프로필, 경력, 자격증, 리뷰 등을 포함합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '전문가 ID', 
    type: Number,
    example: 1 
  })
  @ApiResponse({ 
    status: 200, 
    description: '전문가 상세 정보 조회 성공', 
    type: ExpertDetailResponseDto 
  })
  @ApiResponse({ status: 404, description: '전문가를 찾을 수 없습니다.' })
  async getExpertDetail(@Param('id', ParseIntPipe) id: number): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.getExpertDetail(id);
  }

  @Get(':id/schedules')
  @ApiOperation({ 
    summary: '📅 전문가 일정 조회', 
    description: '특정 전문가의 예약 가능한 일정을 조회합니다. 예약 가능한 시간만 반환됩니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '전문가 ID', 
    type: Number,
    example: 1 
  })
  @ApiResponse({ 
    status: 200, 
    description: '전문가 일정 조회 성공', 
    type: [ScheduleResponseDto] 
  })
  @ApiResponse({ status: 404, description: '전문가를 찾을 수 없습니다.' })
  async getExpertSchedules(@Param('id', ParseIntPipe) expertId: number): Promise<ScheduleResponseDto[]> {
    return await this.schedulesService.getAvailableSchedules(expertId);
  }

  // ========== 전문가 전용 API ==========
  @Put('profile')
  @ApiOperation({ 
    summary: '✏️ 전문가 프로필 수정', 
    description: `전문가가 자신의 프로필을 수정합니다.
    
**수정 가능한 정보:**
- 기본 정보 (이름, 소개, 전문분야)
- 경력 사항
- 자격증 정보
- 상담료
- 상담 가능 지역` 
  })
  @ApiResponse({ 
    status: 200, 
    description: '프로필 수정 성공', 
    type: ExpertDetailResponseDto 
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
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
  @ApiOperation({ 
    summary: '👤 내 프로필 조회', 
    description: '전문가가 자신의 상세 프로필을 조회합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '프로필 조회 성공', 
    type: ExpertDetailResponseDto 
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '전문가 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  async getMyProfile(@Req() req: AuthenticatedRequest): Promise<ExpertDetailResponseDto> {
    return await this.expertsService.getExpertProfile(req.user.userId);
  }

  @Get('schedules/me')
  @ApiOperation({ 
    summary: '📅 내 일정 조회', 
    description: `전문가가 자신의 모든 일정을 조회합니다.
    
**조회되는 일정:**
- 예약 가능한 시간
- 예약된 시간
- 완료된 상담
- 취소된 예약` 
  })
  @ApiResponse({ 
    status: 200, 
    description: '일정 조회 성공', 
    type: [ScheduleResponseDto] 
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '전문가 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  async getMySchedules(@Req() req: AuthenticatedRequest): Promise<ScheduleResponseDto[]> {
    return await this.schedulesService.getExpertSchedules(req.user.userId, req.user.userId);
  }
}