import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminDashboardStatsDto } from './dto/admin-stats.dto';
import { AdminUserQueryDto, AdminUserListResponseDto, UserStatusUpdateDto, UserStatusUpdateResponseDto } from './dto/admin-user-management.dto';
import { ExpertVerificationDto, ExpertVerificationResponseDto, PendingExpertsListDto } from './dto/expert-verification.dto';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { CreateInitialAdminDto } from './dto/create-initial-admin.dto';

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
    console.log('🔍 Controller received body:', JSON.stringify(body));
    console.log('🔍 Controller received expertId param:', expertIdParam);
    console.log('🔍 Controller body.user_id:', body.user_id, 'type:', typeof body.user_id);
    console.log('🔍 Controller body.is_verified:', body.is_verified);
    console.log('🔍 Controller body.verification_note:', body.verification_note);
    
    // expertId 파라미터 처리 (0이나 null인 경우 처리)
    const expertId = expertIdParam === '0' || expertIdParam === 'null' ? 0 : parseInt(expertIdParam);
    
    // TransformRequestInterceptor에 의해 이미 snake_case로 변환됨
    const verificationDto = {
      is_verified: body.is_verified,
      verification_note: body.verification_note,
      user_id: body.user_id // PENDING 사용자의 경우 필요
    };
    
    console.log('✅ Controller transformed to:', JSON.stringify(verificationDto));
    console.log('✅ Controller expertId:', expertId);
    
    const adminId = req.user.userId;
    return await this.adminService.verifyExpert(expertId, verificationDto, adminId);
  }
}