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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserType } from '../entities/user.entity';
import { AdminScopedServiceExample } from './admin-scoped.service.example';
import { AuthAdapterUtil } from '../common/utils/auth-adapter.util';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';

@ApiTags('⚙️ admin-scoped')
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminScopedControllerExample {
  constructor(private readonly adminScopedService: AdminScopedServiceExample) {}

  // 1. 센터별 권한이 적용된 센터 목록 조회
  @Get('centers')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '관리 가능한 센터 목록 조회',
    description: '사용자의 권한에 따라 관리할 수 있는 센터들만 조회됩니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getManagedCenters(@Req() req: AuthenticatedRequest) {
    const scopeUser = AuthAdapterUtil.toScopeUser(req.user);
    return await this.adminScopedService.getCentersWithScope(scopeUser);
  }

  // 2. 특정 센터의 직원 목록 조회 (센터장은 자신의 센터만)
  @Get('centers/:centerId/staff')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '센터 직원 목록 조회',
    description: '센터장은 자신의 센터 직원만, 지역관리자는 담당 지역 센터들의 직원을 조회할 수 있습니다.'
  })
  @ApiParam({ name: 'centerId', description: '센터 ID' })
  @ApiBearerAuth('JWT-auth')
  async getCenterStaff(
    @Param('centerId', ParseIntPipe) centerId: number,
    @Req() req: AuthenticatedRequest
  ) {
    const scopeUser = AuthAdapterUtil.toScopeUser(req.user);
    return await this.adminScopedService.getStaffWithScope(scopeUser, centerId);
  }

  // 3. 특정 센터의 전문가 목록 조회
  @Get('centers/:centerId/experts')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '센터 전문가 목록 조회',
    description: '센터장은 자신의 센터 전문가만 조회할 수 있습니다.'
  })
  @ApiParam({ name: 'centerId', description: '센터 ID' })
  @ApiBearerAuth('JWT-auth')
  async getCenterExperts(
    @Param('centerId', ParseIntPipe) centerId: number,
    @Req() req: AuthenticatedRequest
  ) {
    const scopeUser = AuthAdapterUtil.toScopeUser(req.user);
    return await this.adminScopedService.getExpertsWithScope(scopeUser, centerId);
  }

  // 4. 전문가 휴가 관리 (센터장의 소속 전문가만)
  @Put('experts/:expertId/vacation')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '전문가 휴가 설정',
    description: '센터장은 소속 전문가의 휴가를 설정할 수 있습니다.'
  })
  @ApiParam({ name: 'expertId', description: '전문가 ID' })
  @ApiBearerAuth('JWT-auth')
  async setExpertVacation(
    @Param('expertId', ParseIntPipe) expertId: number,
    @Body() vacationData: {
      startDate: string;
      endDate: string;
      reason: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return await this.adminScopedService.manageExpertVacation(req.user, expertId, {
      startDate: new Date(vacationData.startDate),
      endDate: new Date(vacationData.endDate),
      reason: vacationData.reason
    });
  }

  // 5. 전문가 근무시간 모니터링 (센터장의 소속 전문가만)
  @Get('experts/:expertId/working-hours')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '전문가 근무시간 조회',
    description: '센터장은 소속 전문가의 근무시간을 모니터링할 수 있습니다.'
  })
  @ApiParam({ name: 'expertId', description: '전문가 ID' })
  @ApiBearerAuth('JWT-auth')
  async getExpertWorkingHours(
    @Param('expertId', ParseIntPipe) expertId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: AuthenticatedRequest
  ) {
    return await this.adminScopedService.getExpertWorkingHours(
      req.user,
      expertId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  // 6. 지역별 통계 조회 (지역관리자의 담당 지역만)
  @Get('regional/statistics')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '지역 통계 조회',
    description: '지역관리자는 담당 지역의 통계만 조회할 수 있습니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getRegionalStatistics(@Req() req: AuthenticatedRequest) {
    const scopeUser = AuthAdapterUtil.toScopeUser(req.user);
    return await this.adminScopedService.getCenterStatistics(scopeUser);
  }

  // 7. 전체 관리 직원 목록 조회 (권한별 필터링)
  @Get('staff')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '관리 직원 목록 조회',
    description: '사용자의 권한에 따라 관리할 수 있는 직원들만 조회됩니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getAllManagedStaff(@Req() req: AuthenticatedRequest) {
    const scopeUser = AuthAdapterUtil.toScopeUser(req.user);
    return await this.adminScopedService.getStaffWithScope(scopeUser);
  }

  // 8. 전체 관리 전문가 목록 조회 (권한별 필터링)
  @Get('experts')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '관리 전문가 목록 조회',
    description: '사용자의 권한에 따라 관리할 수 있는 전문가들만 조회됩니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getAllManagedExperts(@Req() req: AuthenticatedRequest) {
    const scopeUser = AuthAdapterUtil.toScopeUser(req.user);
    return await this.adminScopedService.getExpertsWithScope(scopeUser);
  }

  // 9. 센터 계층 구조 조회 (권한별)
  @Get('hierarchy')
  @UseGuards(AdminGuard)
  @ApiOperation({ 
    summary: '센터 계층 구조 조회',
    description: '사용자의 권한에 따른 센터 계층 구조를 조회합니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getCenterHierarchy(@Req() req: AuthenticatedRequest) {
    const scopeUser = AuthAdapterUtil.toScopeUser(req.user);
    const centers = await this.adminScopedService.getCentersWithScope(scopeUser);
    
    // 계층 구조로 변환하는 로직
    const buildHierarchy = (centers: any[], parentId: number | null = null) => {
      return centers
        .filter(center => center.parent_center_id === parentId)
        .map(center => ({
          ...center,
          children: buildHierarchy(centers, center.id)
        }));
    };

    return buildHierarchy(centers);
  }

  // 10. 권한 확인 API
  @Get('permissions/check')
  @ApiOperation({ 
    summary: '현재 사용자 권한 확인',
    description: '현재 로그인한 사용자의 권한과 관리 범위를 확인합니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async checkPermissions(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    const statistics = await this.adminScopedService.getCenterStatistics(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        userType: user.user_type,
        centerId: user.center_id
      },
      permissions: {
        canManageAllCenters: user.user_type === UserType.SUPER_ADMIN,
        canManageRegion: [UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER].includes(user.user_type),
        canManageCenter: [UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER, UserType.CENTER_MANAGER].includes(user.user_type),
        managedCentersCount: statistics.totalCenters,
        managedStaffCount: statistics.totalStaff,
        managedExpertsCount: statistics.totalExperts
      }
    };
  }
}