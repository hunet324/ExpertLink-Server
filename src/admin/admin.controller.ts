import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminDashboardStatsDto } from './dto/admin-stats.dto';
import { AdminUserQueryDto, AdminUserListResponseDto, UserStatusUpdateDto, UserStatusUpdateResponseDto, UserUpdateDto, UserUpdateResponseDto } from './dto/admin-user-management.dto';
import { ExpertVerificationDto, ExpertVerificationResponseDto, PendingExpertsListDto } from './dto/expert-verification.dto';
import { UpdateExpertComprehensiveDto, UpdateExpertComprehensiveResponseDto } from './dto/update-expert-comprehensive.dto';
import { SystemLogQueryDto, SystemLogListResponseDto, SystemLogResponseDto, SystemLogStatsDto, CleanupLogsDto } from './dto/system-log.dto';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { CreateInitialAdminDto } from './dto/create-initial-admin.dto';
import { LoggerUtil } from '../common/utils/logger.util';

@ApiTags('⚙️ admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('initial-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '초기 관리자 생성', description: '시스템 첫 설정 시 초기 관리자 계정을 생성합니다.' })
  @ApiResponse({ status: 201, description: '초기 관리자 생성 성공' })
  @ApiResponse({ status: 409, description: '이미 관리자 계정이 존재하거나 이메일 중복' })
  async createInitialAdmin(@Body() createDto: CreateInitialAdminDto): Promise<any> {
    return await this.adminService.createInitialAdmin(createDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard) // JWT 인증 + 관리자 권한 필요
  @Get('stats')
  @ApiOperation({ summary: '관리자 대시보드 통계', description: '사용자, 전문가, 상담 등의 전체 통계를 조회합니다.' })
  @ApiResponse({ status: 200, description: '통계 조회 성공', type: AdminDashboardStatsDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    return await this.adminService.getDashboardStats();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users')
  @ApiOperation({ summary: '사용자 목록 조회', description: '관리자가 전체 사용자 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '사용자 목록 조회 성공', type: AdminUserListResponseDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getUsers(@Query() query: AdminUserQueryDto): Promise<AdminUserListResponseDto> {
    return await this.adminService.getUsers(query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users/:id')
  @ApiOperation({ summary: '특정 사용자 조회', description: '관리자가 특정 사용자의 상세 정보를 조회합니다.' })
  @ApiParam({ name: 'id', description: '사용자 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '사용자 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async getUserById(@Param('id', ParseIntPipe) userId: number): Promise<any> {
    return await this.adminService.getUserById(userId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '사용자 정보 수정', description: '관리자가 사용자의 정보를 수정합니다.' })
  @ApiParam({ name: 'id', description: '사용자 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '사용자 정보 수정 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async updateUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateData: UserUpdateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserUpdateResponseDto> {
    const adminId = req.user.userId;
    return await this.adminService.updateUser(userId, updateData, adminId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '사용자 상태 변경', description: '관리자가 사용자의 상태(활성/비활성/탈퇴 등)를 변경합니다.' })
  @ApiParam({ name: 'id', description: '사용자 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '사용자 상태 변경 성공', type: UserStatusUpdateResponseDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async updateUserStatus(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateDto: UserStatusUpdateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserStatusUpdateResponseDto> {
    const adminId = req.user.userId;
    return await this.adminService.updateUserStatus(userId, updateDto, adminId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('experts/pending')
  @ApiOperation({ summary: '승인 대기 전문가 목록', description: '승인이 필요한 전문가들의 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '승인 대기 전문가 목록 조회 성공', type: PendingExpertsListDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getPendingExperts(): Promise<PendingExpertsListDto> {
    return await this.adminService.getPendingExperts();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('experts/:id/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '전문가 종합 정보 수정', 
    description: '관리자가 전문가의 기본 사용자 정보와 프로필 정보를 한 번에 수정합니다.' 
  })
  @ApiParam({ name: 'id', description: '전문가 사용자 ID', type: 'number' })
  @ApiBody({
    description: '전문가 종합 정보 수정 요청 데이터',
    type: UpdateExpertComprehensiveDto,
    schema: {
      type: 'object',
      properties: {
        // Basic user fields
        name: {
          type: 'string',
          description: '사용자 이름',
          example: '김전문가'
        },
        phone: {
          type: 'string',
          description: '전화번호',
          example: '010-1234-5678'
        },
        status: {
          type: 'string',
          enum: ['pending', 'active', 'inactive', 'withdrawn'],
          description: '사용자 상태',
          example: 'active'
        },
        centerId: {
          type: 'number',
          description: '소속 센터 ID',
          example: 1
        },
        // Expert profile fields
        licenseNumber: {
          type: 'string',
          description: '자격증 번호',
          example: 'PSY-2023-001234'
        },
        licenseType: {
          type: 'string',
          description: '자격증 유형',
          example: '상담심리사 1급'
        },
        yearsExperience: {
          type: 'number',
          description: '경력 년수',
          example: 5
        },
        hourlyRate: {
          type: 'number',
          description: '시급',
          example: 80000
        },
        specialization: {
          type: 'array',
          items: { type: 'string' },
          description: '전문 분야',
          example: ['우울증', '불안장애', '부부상담']
        },
        introduction: {
          type: 'string',
          description: '소개',
          example: '10년 경력의 전문 상담사입니다.'
        },
        education: {
          type: 'string',
          description: '학력',
          example: '서울대학교 심리학과 박사'
        },
        careerHistory: {
          type: 'string',
          description: '경력 사항',
          example: '서울대병원 정신건강의학과 5년 근무'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: '전문가 종합 정보 수정 성공',
    type: UpdateExpertComprehensiveResponseDto
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '전문가를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async updateExpertProfile(
    @Param('id', ParseIntPipe) expertUserId: number,
    @Body() updateData: UpdateExpertComprehensiveDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UpdateExpertComprehensiveResponseDto> {
    const adminId = req.user.userId;
    return await this.adminService.updateExpertComprehensive(expertUserId, updateData, adminId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard) // JWT 인증 + 관리자 권한 필요
  @Put('experts/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '전문가 승인/거절', description: '관리자가 전문가를 승인하거나 거절합니다.' })
  @ApiParam({ name: 'id', description: '전문가 프로필 ID (PENDING 사용자의 경우 0 또는 null)', type: 'string' })
  @ApiBody({
    description: '전문가 승인/거절 요청 데이터',
    schema: {
      type: 'object',
      properties: {
        isVerified: {
          type: 'boolean',
          description: '전문가 승인 여부',
          example: true
        },
        verificationNote: {
          type: 'string',
          description: '승인/거절 사유 또는 참고사항',
          example: '관리자에 의한 승인 처리'
        },
        userId: {
          type: 'number',
          description: '사용자 ID (프로필이 없는 PENDING 사용자의 경우 필수)',
          example: 5
        }
      },
      required: ['isVerified']
    }
  })
  @ApiResponse({ status: 200, description: '전문가 승인/거절 처리 성공', type: ExpertVerificationResponseDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '전문가 프로필을 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async verifyExpert(
    @Param('id') expertIdParam: string, // ParseIntPipe 제거하여 0이나 null 처리 가능
    @Body() body: any, // 일단 any로 받아서 수동 변환
    @Req() req: AuthenticatedRequest,
  ): Promise<ExpertVerificationResponseDto> {
    LoggerUtil.debug('Controller received body', body);
    LoggerUtil.debug('Controller received expertId param', { expertIdParam });
    LoggerUtil.debug('Controller body details', {
      user_id: body.user_id,
      user_id_type: typeof body.user_id,
      is_verified: body.is_verified,
      verification_note: body.verification_note
    });
    
    // expertId 파라미터 처리 (0이나 null인 경우 처리)
    const expertId = expertIdParam === '0' || expertIdParam === 'null' ? 0 : parseInt(expertIdParam);
    
    // TransformRequestInterceptor에 의해 이미 snake_case로 변환됨
    const verificationDto = {
      is_verified: body.is_verified,
      verification_note: body.verification_note,
      user_id: body.user_id // PENDING 사용자의 경우 필요
    };
    
    LoggerUtil.debug('Controller transformed to', verificationDto);
    LoggerUtil.debug('Controller expertId', { expertId });
    
    const adminId = req.user.userId;
    return await this.adminService.verifyExpert(expertId, verificationDto, adminId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('schedules')
  @ApiOperation({ summary: '전체 일정 조회', description: '관리자가 모든 센터의 일정을 조회합니다.' })
  @ApiQuery({ 
    name: 'center_id', 
    required: false, 
    description: '특정 센터의 일정만 조회하려는 경우 센터 ID', 
    example: 1 
  })
  @ApiResponse({ status: 200, description: '일정 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getAllSchedules(
    @Query('center_id') centerId?: string,
  ): Promise<{
    schedules: any[];
    totalSchedules: number;
    availableSchedules: number;
    bookedSchedules: number;
    completedSchedules: number;
    cancelledSchedules: number;
  }> {
    const parsedCenterId = centerId ? parseInt(centerId) : undefined;
    return await this.adminService.getAllSchedules(parsedCenterId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('schedules/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '일정 취소', description: '관리자가 특정 일정을 취소합니다.' })
  @ApiParam({ name: 'id', description: '일정 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '일정 취소 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '일정을 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async cancelSchedule(
    @Param('id', ParseIntPipe) scheduleId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    const adminId = req.user.userId;
    return await this.adminService.cancelSchedule(scheduleId, adminId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('experts')
  @ApiOperation({ summary: '전체 전문가 목록 조회', description: '모든 센터의 전문가 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '전문가 목록 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getAllExperts(): Promise<any[]> {
    return await this.adminService.getAllExperts();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('experts/:id/working-hours')
  @ApiOperation({ summary: '전문가 근무시간 조회', description: '특정 전문가의 날짜별 근무시간을 조회합니다.' })
  @ApiParam({ name: 'id', description: '전문가 ID', type: 'number' })
  @ApiQuery({ 
    name: 'startDate', 
    required: true, 
    description: '조회 시작 날짜 (YYYY-MM-DD)', 
    example: '2025-08-01' 
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: true, 
    description: '조회 종료 날짜 (YYYY-MM-DD)', 
    example: '2025-08-31' 
  })
  @ApiResponse({ status: 200, description: '근무시간 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '전문가를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async getExpertWorkingHours(
    @Param('id', ParseIntPipe) expertId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<any[]> {
    return await this.adminService.getExpertWorkingHours(expertId, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('psych-tests')
  @ApiOperation({ summary: '설문 테스트 목록 조회', description: '관리자가 모든 설문 테스트를 조회합니다.' })
  @ApiResponse({ status: 200, description: '설문 테스트 목록 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getAllPsychTests(): Promise<any[]> {
    return await this.adminService.getAllPsychTests();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('psych-tests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설문 테스트 생성', description: '관리자가 새로운 설문 테스트를 생성합니다.' })
  @ApiBody({
    description: '설문 테스트 생성 요청 데이터',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '설문 테스트 제목', example: '스트레스 척도 검사' },
        description: { type: 'string', description: '설문 테스트 설명', example: '일상생활에서 느끼는 스트레스 정도를 측정하는 검사입니다.' },
        logicType: { type: 'string', enum: ['scale', 'mbti', 'category'], description: '검사 로직 유형', example: 'scale' },
        isActive: { type: 'boolean', description: '활성화 여부', example: true },
        maxScore: { type: 'number', description: '최대 점수 (scale 타입)', example: 40 },
        estimatedTime: { type: 'number', description: '예상 소요 시간(분)', example: 10 },
        instruction: { type: 'string', description: '검사 안내 문구', example: '다음 문항들을 읽고 최근 2주간의 경험을 바탕으로 답변해주세요.' },
        scoringRules: { type: 'object', description: '채점 규칙 (JSON)', example: { "scoring_method": "sum", "reverse_questions": [2, 5] } },
        resultRanges: { type: 'object', description: '결과 해석 범위 (JSON)', example: { "낮음": { "min": 0, "max": 13, "description": "스트레스 수준이 낮습니다." } } }
      },
      required: ['title', 'logicType', 'estimatedTime']
    }
  })
  @ApiResponse({ status: 201, description: '설문 테스트 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async createPsychTest(@Body() testData: any): Promise<any> {
    return await this.adminService.createPsychTest(testData);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('psych-tests/:id')
  @ApiOperation({ summary: '설문 테스트 상세 조회', description: '관리자가 특정 설문 테스트의 상세 정보를 조회합니다.' })
  @ApiParam({ name: 'id', description: '설문 테스트 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '설문 테스트 상세 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '설문 테스트를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async getPsychTestById(@Param('id', ParseIntPipe) testId: number): Promise<any> {
    return await this.adminService.getPsychTestById(testId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('psych-questions')
  @ApiOperation({ summary: '설문 문항 목록 조회', description: '관리자가 설문 문항을 조회합니다.' })
  @ApiQuery({ 
    name: 'testId', 
    required: false, 
    description: '특정 설문 테스트의 문항만 조회하려는 경우 테스트 ID', 
    example: 1 
  })
  @ApiResponse({ status: 200, description: '설문 문항 목록 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getAllPsychQuestions(@Query('testId') testId?: string): Promise<any[]> {
    const parsedTestId = testId ? parseInt(testId) : undefined;
    return await this.adminService.getAllPsychQuestions(parsedTestId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('psych-questions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설문 문항 생성', description: '관리자가 새로운 설문 문항을 생성합니다.' })
  @ApiBody({
    description: '설문 문항 생성 요청 데이터',
    schema: {
      type: 'object',
      properties: {
        testId: { type: 'number', description: '설문 테스트 ID', example: 1 },
        question: { type: 'string', description: '문항 내용', example: '현재 나이를 선택해 주세요' },
        questionType: { type: 'string', enum: ['multiple_choice', 'scale', 'text', 'yes_no'], description: '문항 유형' },
        questionOrder: { type: 'number', description: '문항 순서', example: 1 },
        options: { type: 'array', description: '선택지 목록', items: { type: 'object' } },
        isRequired: { type: 'boolean', description: '필수 문항 여부', example: true },
        helpText: { type: 'string', description: '도움말 텍스트', example: '해당하는 연령대를 선택하세요' }
      },
      required: ['testId', 'question', 'questionType', 'questionOrder']
    }
  })
  @ApiResponse({ status: 201, description: '설문 문항 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '설문 테스트를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async createPsychQuestion(@Body() questionData: any): Promise<any> {
    return await this.adminService.createPsychQuestion(questionData);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('psych-questions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '설문 문항 수정', description: '관리자가 설문 문항을 수정합니다.' })
  @ApiParam({ name: 'id', description: '설문 문항 ID', type: 'number' })
  @ApiBody({
    description: '설문 문항 수정 요청 데이터',
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '문항 내용' },
        questionType: { type: 'string', enum: ['multiple_choice', 'scale', 'text', 'yes_no'], description: '문항 유형' },
        questionOrder: { type: 'number', description: '문항 순서' },
        options: { type: 'array', description: '선택지 목록' },
        isRequired: { type: 'boolean', description: '필수 문항 여부' },
        helpText: { type: 'string', description: '도움말 텍스트' }
      }
    }
  })
  @ApiResponse({ status: 200, description: '설문 문항 수정 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '설문 문항을 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async updatePsychQuestion(
    @Param('id', ParseIntPipe) questionId: number,
    @Body() questionData: any
  ): Promise<any> {
    return await this.adminService.updatePsychQuestion(questionId, questionData);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('psych-questions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '설문 문항 삭제', description: '관리자가 설문 문항을 삭제합니다.' })
  @ApiParam({ name: 'id', description: '설문 문항 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '설문 문항 삭제 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '설문 문항을 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async deletePsychQuestion(@Param('id', ParseIntPipe) questionId: number): Promise<{ success: boolean; message: string }> {
    return await this.adminService.deletePsychQuestion(questionId);
  }

  // 분기 로직 관리 API
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('logic-rules')
  @ApiOperation({ summary: '분기 로직 목록 조회', description: '관리자가 분기 로직 규칙을 조회합니다.' })
  @ApiQuery({ 
    name: 'testId', 
    required: false, 
    description: '특정 설문 테스트의 분기 로직만 조회하려는 경우 테스트 ID', 
    example: 1 
  })
  @ApiResponse({ status: 200, description: '분기 로직 목록 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getAllLogicRules(@Query('testId') testId?: string): Promise<any[]> {
    const parsedTestId = testId ? parseInt(testId) : undefined;
    return await this.adminService.getAllLogicRules(parsedTestId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('logic-rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '분기 로직 생성', description: '관리자가 새로운 분기 로직을 생성합니다.' })
  @ApiBody({
    description: '분기 로직 생성 요청 데이터',
    schema: {
      type: 'object',
      properties: {
        testId: { type: 'number', description: '설문 테스트 ID', example: 1 },
        name: { type: 'string', description: '분기 로직 이름', example: '우울감 높음 → 상세 질문 표시' },
        description: { type: 'string', description: '분기 로직 설명', example: '우울감 점수가 4점 이상일 때 상세 질문을 표시합니다.' },
        sourceQuestionId: { type: 'number', description: '소스 문항 ID', example: 3 },
        condition: { 
          type: 'object', 
          description: '조건', 
          properties: {
            type: { type: 'string', enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in_range'] },
            value: { description: '조건 값' }
          }
        },
        action: { 
          type: 'object', 
          description: '액션', 
          properties: {
            type: { type: 'string', enum: ['show_question', 'hide_question', 'jump_to_question', 'end_survey', 'show_message'] },
            targetQuestionId: { type: 'number', description: '대상 문항 ID' },
            message: { type: 'string', description: '메시지 내용' }
          }
        },
        priority: { type: 'number', description: '우선순위', example: 1 },
        isActive: { type: 'boolean', description: '활성화 여부', example: true }
      },
      required: ['testId', 'name', 'sourceQuestionId', 'condition', 'action', 'priority']
    }
  })
  @ApiResponse({ status: 201, description: '분기 로직 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async createLogicRule(@Body() ruleData: any): Promise<any> {
    console.log('=== 분기로직 생성 컨트롤러 데이터 ===');
    console.log('ruleData:', JSON.stringify(ruleData, null, 2));
    console.log('testId:', ruleData.testId);
    console.log('sourceQuestionId:', ruleData.sourceQuestionId);
    console.log('action:', JSON.stringify(ruleData.action, null, 2));
    return await this.adminService.createLogicRule(ruleData);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('logic-rules/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '분기 로직 수정', description: '관리자가 분기 로직을 수정합니다.' })
  @ApiParam({ name: 'id', description: '분기 로직 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '분기 로직 수정 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '분기 로직을 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async updateLogicRule(
    @Param('id', ParseIntPipe) ruleId: number,
    @Body() ruleData: any
  ): Promise<any> {
    return await this.adminService.updateLogicRule(ruleId, ruleData);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('logic-rules/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '분기 로직 삭제', description: '관리자가 분기 로직을 삭제합니다.' })
  @ApiParam({ name: 'id', description: '분기 로직 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '분기 로직 삭제 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '분기 로직을 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async deleteLogicRule(@Param('id', ParseIntPipe) ruleId: number): Promise<{ success: boolean; message: string }> {
    return await this.adminService.deleteLogicRule(ruleId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('logic-rules/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '분기 로직 활성/비활성 토글', description: '관리자가 분기 로직의 활성 상태를 토글합니다.' })
  @ApiParam({ name: 'id', description: '분기 로직 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '분기 로직 상태 토글 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '분기 로직을 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async toggleLogicRuleStatus(@Param('id', ParseIntPipe) ruleId: number): Promise<any> {
    console.log('=== 분기로직 상태 토글 컨트롤러 ===');
    console.log('ruleId:', ruleId, 'type:', typeof ruleId);
    return await this.adminService.toggleLogicRuleStatus(ruleId);
  }

  // ======================
  // 결제 관리 API
  // ======================

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '결제 내역 조회', description: '관리자가 결제 내역을 조회합니다.' })
  @ApiQuery({ name: 'status', required: false, enum: ['completed', 'pending', 'failed', 'refunded', 'cancelled'], description: '결제 상태 필터' })
  @ApiQuery({ name: 'serviceType', required: false, enum: ['video', 'chat', 'voice', 'test'], description: '서비스 타입 필터' })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: ['card', 'bank', 'kakao', 'paypal'], description: '결제 방법 필터' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '시작 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '종료 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '검색어 (고객명, 전문가명, 거래ID)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 항목 수' })
  @ApiResponse({ status: 200, description: '결제 내역 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getAllPayments(
    @Query('status') status?: string,
    @Query('serviceType') serviceType?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return await this.adminService.getAllPayments({
      status,
      serviceType,
      paymentMethod,
      startDate,
      endDate,
      search,
      page: page || 1,
      limit: limit || 20
    });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('payments/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '결제 통계 조회', description: '관리자가 결제 통계를 조회합니다.' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '시작 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '종료 날짜 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '결제 통계 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getPaymentStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return await this.adminService.getPaymentStats(startDate, endDate);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('payments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '결제 상세 조회', description: '관리자가 결제 상세 정보를 조회합니다.' })
  @ApiParam({ name: 'id', type: Number, description: '결제 ID' })
  @ApiResponse({ status: 200, description: '결제 상세 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '결제를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async getPaymentById(@Param('id', ParseIntPipe) paymentId: number): Promise<any> {
    return await this.adminService.getPaymentById(paymentId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('payments/:id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '결제 환불 처리', description: '관리자가 결제를 환불 처리합니다.' })
  @ApiParam({ name: 'id', type: Number, description: '결제 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '환불 사유', example: '고객 요청에 의한 환불' }
      },
      required: ['reason']
    }
  })
  @ApiResponse({ status: 200, description: '환불 처리 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '결제를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async refundPayment(
    @Param('id', ParseIntPipe) paymentId: number,
    @Body() refundData: { reason: string }
  ): Promise<any> {
    return await this.adminService.refundPayment(paymentId, refundData.reason);
  }


  // ======================
  // 매출 통계 API
  // ======================

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('revenue/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매출 통계 조회', description: '관리자가 매출 통계를 조회합니다.' })
  @ApiQuery({ name: 'periodType', required: false, enum: ['daily', 'weekly', 'monthly', 'yearly'], description: '기간 타입' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '시작 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '종료 날짜 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '매출 통계 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getRevenueStats(
    @Query('periodType') periodType: string = 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return await this.adminService.getRevenueStats(periodType, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('revenue/trends')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '매출 트렌드 조회', description: '관리자가 매출 트렌드 데이터를 조회합니다.' })
  @ApiQuery({ name: 'periodType', required: false, enum: ['daily', 'weekly', 'monthly', 'yearly'], description: '기간 타입' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '시작 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '종료 날짜 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '매출 트렌드 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getRevenueTrends(
    @Query('periodType') periodType: string = 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return await this.adminService.getRevenueTrends(periodType, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('revenue/expert-rankings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '전문가 매출 랭킹 조회', description: '관리자가 전문가 매출 랭킹을 조회합니다.' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '시작 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '종료 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '조회할 전문가 수' })
  @ApiResponse({ status: 200, description: '전문가 매출 랭킹 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getExpertRankings(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return await this.adminService.getExpertRankings(startDate, endDate, limit || 10);
  }

  // ======================
  // 시스템 로그 관리 API
  // ======================

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('system/logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '시스템 로그 조회', description: '관리자가 시스템 운영 로그를 조회합니다.' })
  @ApiResponse({ status: 200, description: '시스템 로그 조회 성공', type: SystemLogListResponseDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getSystemLogs(@Query() query: SystemLogQueryDto): Promise<SystemLogListResponseDto> {
    return await this.adminService.getSystemLogs(query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('system/logs/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '시스템 로그 통계 조회', description: '관리자가 시스템 로그 통계를 조회합니다.' })
  @ApiQuery({ name: 'start_date', required: false, type: String, description: '시작 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, type: String, description: '종료 날짜 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '시스템 로그 통계 조회 성공', type: SystemLogStatsDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async getSystemLogStats(
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ): Promise<SystemLogStatsDto> {
    return await this.adminService.getSystemLogStats(start_date, end_date);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('system/logs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '시스템 로그 상세 조회', description: '관리자가 특정 시스템 로그의 상세 정보를 조회합니다.' })
  @ApiParam({ name: 'id', description: '로그 ID' })
  @ApiResponse({ status: 200, description: '시스템 로그 상세 조회 성공', type: SystemLogResponseDto })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '로그를 찾을 수 없습니다.' })
  @ApiBearerAuth('JWT-auth')
  async getSystemLogById(@Param('id', ParseIntPipe) id: number): Promise<SystemLogResponseDto> {
    return await this.adminService.getSystemLogById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('system/logs/cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '오래된 로그 정리', description: '관리자가 지정된 일수보다 오래된 시스템 로그를 삭제합니다.' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '삭제할 로그의 일수 (기본: 30일)' })
  @ApiResponse({ status: 200, description: '로그 정리 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async cleanupOldLogs(
    @Query('days', ParseIntPipe) days: number = 30,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    LoggerUtil.info(`관리자 ${req.user.name}(${req.user.id})가 ${days}일 이전 로그 정리를 요청했습니다.`);
    return await this.adminService.cleanupOldLogs(days, req.user.id, req.user.name, req.ip);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('system/logs/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '시스템 로그 내보내기', description: '관리자가 시스템 로그를 CSV 형태로 내보냅니다.' })
  @ApiBody({ type: SystemLogQueryDto, description: '내보낼 로그 필터 조건' })
  @ApiResponse({ status: 200, description: '로그 내보내기 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  async exportSystemLogs(
    @Body() query: SystemLogQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; downloadUrl: string; fileName: string }> {
    LoggerUtil.info(`관리자 ${req.user.name}(${req.user.id})가 시스템 로그 내보내기를 요청했습니다.`);
    return await this.adminService.exportSystemLogs(query, req.user.id, req.user.name, req.ip);
  }
}