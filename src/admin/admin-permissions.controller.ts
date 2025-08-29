import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission, PermissionGuard } from '../common/guards/permission.guard';
import { AdminPermissionsService } from './admin-permissions.service';

@ApiTags('관리자 권한 관리')
@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AdminPermissionsController {
  constructor(private readonly adminPermissionsService: AdminPermissionsService) {}

  @Get('roles')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '역할 목록 조회', description: '모든 관리자 역할을 조회합니다.' })
  @ApiResponse({ status: 200, description: '역할 목록 조회 성공' })
  async getRoles() {
    return await this.adminPermissionsService.getAllRoles();
  }

  @Post('roles')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '새 역할 생성', description: '새로운 관리자 역할을 생성합니다.' })
  @ApiResponse({ status: 201, description: '역할 생성 성공' })
  async createRole(@Body() createRoleDto: any, @Request() req) {
    return await this.adminPermissionsService.createRole(createRoleDto, req.user.id);
  }

  @Put('roles/:id')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '역할 수정', description: '기존 역할의 정보를 수정합니다.' })
  @ApiResponse({ status: 200, description: '역할 수정 성공' })
  async updateRole(@Param('id') id: number, @Body() updateRoleDto: any, @Request() req) {
    return await this.adminPermissionsService.updateRole(id, updateRoleDto, req.user.id);
  }

  @Delete('roles/:id')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '역할 삭제', description: '역할을 삭제합니다. (시스템 기본 역할은 삭제 불가)' })
  @ApiResponse({ status: 200, description: '역할 삭제 성공' })
  async deleteRole(@Param('id') id: number, @Request() req) {
    return await this.adminPermissionsService.deleteRole(id, req.user.id);
  }

  @Get('permissions')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '권한 목록 조회', description: '모든 권한을 카테고리별로 조회합니다.' })
  @ApiResponse({ status: 200, description: '권한 목록 조회 성공' })
  async getPermissions() {
    return await this.adminPermissionsService.getAllPermissions();
  }

  @Get('roles/:id/permissions')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '역할별 권한 조회', description: '특정 역할에 할당된 권한 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '역할별 권한 조회 성공' })
  async getRolePermissions(@Param('id') id: number) {
    return await this.adminPermissionsService.getRolePermissions(id);
  }

  @Put('roles/:id/permissions')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '역할 권한 설정', description: '역할에 권한을 할당하거나 제거합니다.' })
  @ApiResponse({ status: 200, description: '역할 권한 설정 성공' })
  async setRolePermissions(
    @Param('id') roleId: number,
    @Body() dto: { permissionIds: number[] },
    @Request() req
  ) {
    return await this.adminPermissionsService.setRolePermissions(
      roleId,
      dto.permissionIds,
      req.user.id
    );
  }

  @Get('users')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '관리자 계정 목록', description: '역할이 할당된 관리자 계정 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '관리자 계정 목록 조회 성공' })
  async getAdminUsers(@Query() query: any) {
    return await this.adminPermissionsService.getAdminUsers(query);
  }

  @Post('users/:id/roles')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '사용자 역할 할당', description: '사용자에게 관리자 역할을 할당합니다.' })
  @ApiResponse({ status: 200, description: '역할 할당 성공' })
  async assignUserRole(
    @Param('id') userId: number,
    @Body() dto: { roleId: number, expiresAt?: string },
    @Request() req
  ) {
    return await this.adminPermissionsService.assignUserRole(
      userId,
      dto.roleId,
      req.user.id,
      dto.expiresAt ? new Date(dto.expiresAt) : null
    );
  }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '사용자 역할 해제', description: '사용자에게서 관리자 역할을 해제합니다.' })
  @ApiResponse({ status: 200, description: '역할 해제 성공' })
  async revokeUserRole(
    @Param('userId') userId: number,
    @Param('roleId') roleId: number,
    @Request() req
  ) {
    return await this.adminPermissionsService.revokeUserRole(userId, roleId, req.user.id);
  }

  @Get('users/:id')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '사용자 권한 정보 조회', description: '특정 사용자의 역할과 권한 정보를 조회합니다.' })
  @ApiResponse({ status: 200, description: '사용자 권한 정보 조회 성공' })
  async getUserPermissions(@Param('id') userId: number) {
    return await this.adminPermissionsService.getUserPermissions(userId);
  }

  @Get('audit-logs')
  @RequirePermission('admin_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '권한 변경 감사 로그', description: '관리자 권한 변경 이력을 조회합니다.' })
  @ApiResponse({ status: 200, description: '감사 로그 조회 성공' })
  async getAuditLogs(@Query() query: any) {
    return await this.adminPermissionsService.getAuditLogs(query);
  }

  @Get('my-permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '내 권한 조회', description: '현재 로그인한 사용자의 권한을 조회합니다.' })
  @ApiResponse({ status: 200, description: '내 권한 조회 성공' })
  async getMyPermissions(@Request() req) {
    return await this.adminPermissionsService.getUserPermissions(req.user.id);
  }
}