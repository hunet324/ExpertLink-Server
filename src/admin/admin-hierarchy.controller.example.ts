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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { 
  HierarchyGuard, 
  HierarchyCheck, 
  HierarchyMode,
  AllowPeerAccess 
} from '../auth/guards/hierarchy.guard';
import { UserType } from '../entities/user.entity';
import { AdminHierarchyServiceExample } from './admin-hierarchy.service.example';
import { AuthAdapterUtil } from '../common/utils/auth-adapter.util';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';

@ApiTags('⚙️ admin-hierarchy')
@Controller('admin/hierarchy')
@UseGuards(JwtAuthGuard)
export class AdminHierarchyControllerExample {
  constructor(private readonly adminHierarchyService: AdminHierarchyServiceExample) {}

  // 1. 내가 관리할 수 있는 직원 목록 조회
  @Get('staff/manageable')
  @UseGuards(HierarchyGuard)
  @HierarchyCheck(HierarchyMode.SUPERVISOR_ONLY)
  @ApiOperation({ 
    summary: '관리 가능한 직원 목록 조회',
    description: '상급자는 자신의 하급자들만 조회할 수 있습니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getManageableStaff(@Req() req: AuthenticatedRequest) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.getStaffWithHierarchy(hierarchyScope, 'manage');
  }

  // 2. 내가 볼 수 있는 직원 목록 조회 (상급자 포함)
  @Get('staff/viewable')
  @UseGuards(HierarchyGuard)
  @HierarchyCheck(HierarchyMode.SUBORDINATE_READ)
  @ApiOperation({ 
    summary: '조회 가능한 직원 목록',
    description: '하급자는 상급자 정보도 읽기 전용으로 조회할 수 있습니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getViewableStaff(@Req() req: AuthenticatedRequest) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.getStaffWithHierarchy(hierarchyScope, 'view');
  }

  // 3. 특정 사용자 정보 조회 (계층적 권한 체크)
  @Get('user/:userId')
  @UseGuards(HierarchyGuard)
  @HierarchyCheck(HierarchyMode.SUBORDINATE_READ)
  @ApiOperation({ 
    summary: '사용자 정보 조회',
    description: '계층 관계에 따라 사용자 정보를 조회합니다.'
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiBearerAuth('JWT-auth')
  async getUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthenticatedRequest
  ) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.getUserWithHierarchyCheck(hierarchyScope, userId, 'read');
  }

  // 4. 사용자 정보 수정 (상급자만 가능)
  @Put('user/:userId')
  @UseGuards(HierarchyGuard)
  @HierarchyCheck(HierarchyMode.SUPERVISOR_ONLY)
  @ApiOperation({ 
    summary: '사용자 정보 수정',
    description: '상급자만 하급자의 정보를 수정할 수 있습니다.'
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiBearerAuth('JWT-auth')
  async updateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() updateData: {
      name?: string;
      email?: string;
      phone?: string;
      department?: string;
      position?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.updateUserWithHierarchyCheck(hierarchyScope, userId, updateData);
  }

  // 5. 상급자 지정 (계층 구조 관리)
  @Put('user/:userId/supervisor')
  @UseGuards(HierarchyGuard)
  @HierarchyCheck(HierarchyMode.SUPERVISOR_ONLY)
  @ApiOperation({ 
    summary: '상급자 지정',
    description: '사용자의 상급자를 지정하거나 변경합니다. 순환 참조를 방지합니다.'
  })
  @ApiParam({ name: 'userId', description: '하급자 ID' })
  @ApiBearerAuth('JWT-auth')
  async assignSupervisor(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { supervisorId: number },
    @Req() req: AuthenticatedRequest
  ) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.assignSupervisor(hierarchyScope, userId, body.supervisorId);
    return { message: '상급자가 성공적으로 지정되었습니다.' };
  }

  // 6. 내 하급자 목록 조회
  @Get('my/subordinates')
  @ApiOperation({ 
    summary: '내 하급자 목록 조회',
    description: '현재 사용자의 직속 또는 전체 하급자 목록을 조회합니다.'
  })
  @ApiQuery({ name: 'includeIndirect', description: '간접 하급자 포함 여부', required: false, type: Boolean })
  @ApiBearerAuth('JWT-auth')
  async getMySubordinates(
    @Query('includeIndirect') includeIndirect: boolean = false,
    @Req() req: AuthenticatedRequest
  ) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.getMySubordinates(hierarchyScope, includeIndirect);
  }

  // 7. 내 상급자 정보 조회
  @Get('my/supervisor')
  @ApiOperation({ 
    summary: '내 상급자 정보 조회',
    description: '현재 사용자의 상급자 정보를 조회합니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getMySupervisor(@Req() req: AuthenticatedRequest) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.getMySupervisor(hierarchyScope);
  }

  // 8. 계층 구조 트리 조회
  @Get('tree')
  @ApiOperation({ 
    summary: '계층 구조 트리 조회',
    description: '사용자의 권한에 따른 조직 계층 구조를 트리 형태로 조회합니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getHierarchyTree(@Req() req: AuthenticatedRequest) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.getHierarchyTree(hierarchyScope);
  }

  // 9. 특정 사용자와의 계층 관계 분석
  @Get('relationship/:userId')
  @UseGuards(HierarchyGuard)
  @HierarchyCheck(HierarchyMode.SUBORDINATE_READ)
  @ApiOperation({ 
    summary: '사용자와의 계층 관계 분석',
    description: '현재 사용자와 대상 사용자 간의 계층 관계를 분석합니다.'
  })
  @ApiParam({ name: 'userId', description: '대상 사용자 ID' })
  @ApiBearerAuth('JWT-auth')
  async analyzeRelationship(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthenticatedRequest
  ) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    return await this.adminHierarchyService.analyzeRelationship(hierarchyScope, userId);
  }

  // 10. 동급자 목록 조회 (같은 상급자를 가진 사용자들)
  @Get('peers')
  @UseGuards(HierarchyGuard)
  @HierarchyCheck(HierarchyMode.PEER_ALLOWED)
  @AllowPeerAccess()
  @ApiOperation({ 
    summary: '동급자 목록 조회',
    description: '같은 상급자를 가진 동급자들의 목록을 조회합니다.'
  })
  @ApiBearerAuth('JWT-auth')
  async getPeers(@Req() req: AuthenticatedRequest) {
    const currentUser = req.user;
    
    if (!currentUser.supervisor_id) {
      return []; // 상급자가 없으면 동급자도 없음
    }

    // 같은 상급자를 가진 사용자들 조회 (자신 제외)
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(currentUser);
    return await this.adminHierarchyService.getStaffWithHierarchy(
      {
        ...hierarchyScope,
        userId: currentUser.supervisor_id // 상급자 ID로 조회하여 같은 하급자들 찾기
      },
      'manage'
    );
  }

  // 11. 권한 테스트 엔드포인트 (개발/테스트용)
  @Get('test/permissions/:userId')
  @ApiOperation({ 
    summary: '권한 테스트',
    description: '특정 사용자에 대한 권한을 테스트합니다. (개발/테스트용)'
  })
  @ApiParam({ name: 'userId', description: '테스트할 사용자 ID' })
  @ApiBearerAuth('JWT-auth')
  async testPermissions(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthenticatedRequest
  ) {
    const hierarchyScope = AuthAdapterUtil.toHierarchyScope(req.user);
    const relationship = await this.adminHierarchyService.analyzeRelationship(hierarchyScope, userId);
    
    return {
      currentUser: {
        id: req.user.id,
        name: req.user.name,
        userType: req.user.user_type,
        centerId: req.user.center_id,
        supervisorId: req.user.supervisor_id
      },
      targetUserId: userId,
      relationship: relationship.relationship,
      permissions: {
        canRead: relationship.canView,
        canWrite: relationship.canManage,
        hierarchyDistance: relationship.distance
      },
      accessModes: {
        supervisorOnly: relationship.relationship === 'superior',
        peerAllowed: ['superior', 'peer'].includes(relationship.relationship),
        subordinateRead: ['superior', 'subordinate', 'peer'].includes(relationship.relationship),
        strict: relationship.relationship === 'superior' && relationship.distance === 1
      }
    };
  }
}