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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { 
  RoleBasedGuard, 
  MinRole, 
  Roles, 
  SameCenterOnly,
  SuperAdminGuard,
  CenterManagerGuard,
  CenterScopedGuard 
} from '../auth/guards';
import { UserType } from '../entities/user.entity';
import { AdminService } from './admin.service';

@ApiTags('⚙️ admin-improved')
@Controller('admin')
@UseGuards(JwtAuthGuard) // 모든 엔드포인트에 JWT 인증 필요
export class AdminImprovedControllerExample {
  constructor(private readonly adminService: AdminService) {}

  // 예시 1: 최고 관리자만 접근 가능
  @Post('system/reset')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: '시스템 초기화 (최고 관리자 전용)' })
  @ApiBearerAuth('JWT-auth')
  async resetSystem(): Promise<any> {
    return { message: '시스템이 초기화되었습니다.' };
  }

  // 예시 2: 센터장 이상만 접근 가능
  @Get('center/:centerId/stats')
  @UseGuards(RoleBasedGuard, CenterManagerGuard)
  @MinRole(UserType.CENTER_MANAGER)
  @SameCenterOnly() // 자신의 센터만 접근 가능
  @ApiOperation({ summary: '센터 통계 조회 (센터장 이상)' })
  @ApiBearerAuth('JWT-auth')
  async getCenterStats(@Param('centerId', ParseIntPipe) centerId: number): Promise<any> {
    // TODO: AdminService에 getCenterStats 메서드 구현 필요
    return { message: '센터 통계 기능 구현 예정', centerId };
  }

  // 예시 3: 특정 역할만 접근 가능
  @Put('expert/:expertId/verify')
  @UseGuards(RoleBasedGuard)
  @Roles(UserType.CENTER_MANAGER, UserType.REGIONAL_MANAGER, UserType.SUPER_ADMIN)
  @ApiOperation({ summary: '전문가 승인 (센터장, 지역관리자, 최고관리자만)' })
  @ApiBearerAuth('JWT-auth')
  async verifyExpert(@Param('expertId', ParseIntPipe) expertId: number): Promise<any> {
    // TODO: AdminService verifyExpert 메서드 파라미터 수정 필요
    return { message: '전문가 승인 기능 구현 예정', expertId };
  }

  // 예시 4: 센터 범위 제한된 접근
  @Get('center/:centerId/experts')
  @UseGuards(CenterScopedGuard)
  @ApiOperation({ summary: '센터별 전문가 목록 (센터별 접근 제어)' })
  @ApiBearerAuth('JWT-auth')
  async getCenterExperts(@Param('centerId', ParseIntPipe) centerId: number): Promise<any> {
    // TODO: AdminService getCenterExperts 메서드 구현 필요
    return { message: "getCenterExperts 기능 구현 예정" };
  }

  // 예시 5: 최소 권한 레벨 체크
  @Get('reports/revenue')
  @UseGuards(RoleBasedGuard)
  @MinRole(UserType.CENTER_MANAGER) // 센터장 이상만 접근
  @ApiOperation({ summary: '매출 보고서 (센터장 이상)' })
  @ApiBearerAuth('JWT-auth')
  async getRevenueReport(): Promise<any> {
    // TODO: AdminService getRevenueReport 메서드 구현 필요
    return { message: "getRevenueReport 기능 구현 예정" };
  }

  // 예시 6: 복합 권한 체크
  @Put('center/:centerId/expert/:expertId/schedule')
  @UseGuards(RoleBasedGuard)
  @MinRole(UserType.CENTER_MANAGER)
  @SameCenterOnly()
  @ApiOperation({ summary: '전문가 일정 관리 (센터장 이상, 같은 센터만)' })
  @ApiBearerAuth('JWT-auth')
  async manageExpertSchedule(
    @Param('centerId', ParseIntPipe) centerId: number,
    @Param('expertId', ParseIntPipe) expertId: number,
    @Body() scheduleData: any
  ): Promise<any> {
    // TODO: AdminService manageExpertSchedule 메서드 구현 필요
    return { message: "manageExpertSchedule 기능 구현 예정" };
  }

  // 예시 7: 지역 관리자 이상만 접근
  @Get('regional/performance')
  @UseGuards(RoleBasedGuard)
  @MinRole(UserType.REGIONAL_MANAGER)
  @ApiOperation({ summary: '지역별 성과 조회 (지역관리자 이상)' })
  @ApiBearerAuth('JWT-auth')
  async getRegionalPerformance(): Promise<any> {
    // TODO: AdminService getRegionalPerformance 메서드 구현 필요
    return { message: "getRegionalPerformance 기능 구현 예정" };
  }
}