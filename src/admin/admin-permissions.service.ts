import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { AdminRole } from '../entities/admin-role.entity';
import { AdminPermission } from '../entities/admin-permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { PermissionService } from '../common/services/permission.service';

@Injectable()
export class AdminPermissionsService {
  constructor(
    @InjectRepository(AdminRole)
    private roleRepository: Repository<AdminRole>,
    
    @InjectRepository(AdminPermission)
    private permissionRepository: Repository<AdminPermission>,
    
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    
    @InjectRepository(User)
    private userRepository: Repository<User>,
    
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
    
    private permissionService: PermissionService
  ) {}

  async getAllRoles() {
    const roles = await this.roleRepository.find({
      where: { is_active: true },
      relations: ['permissions', 'user_roles'],
      order: { name: 'ASC' }
    });

    return roles.map(role => ({
      ...role,
      userCount: role.user_roles?.filter(ur => ur.is_active).length || 0,
      permissions: role.permissions || []
    }));
  }

  async createRole(createRoleDto: any, createdBy: number) {
    // 역할 코드 중복 체크
    const existingRole = await this.roleRepository.findOne({
      where: { role_code: createRoleDto.role_code }
    });

    if (existingRole) {
      throw new ConflictException('이미 존재하는 역할 코드입니다.');
    }

    const role = this.roleRepository.create({
      ...createRoleDto,
      is_system: false, // 사용자가 생성한 역할은 시스템 역할이 아님
      is_active: true
    });

    const savedResult = await this.roleRepository.save(role);
    const savedRole = Array.isArray(savedResult) ? savedResult[0] : savedResult;

    // 감사 로그 기록
    await this.createAuditLog({
      admin_id: createdBy,
      action: 'create_role',
      resource_type: 'admin_role',
      resource_id: savedRole.id,
      new_values: createRoleDto
    });

    return savedRole;
  }

  async updateRole(roleId: number, updateRoleDto: any, updatedBy: number) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    
    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다.');
    }

    if (role.is_system && (updateRoleDto.role_code || updateRoleDto.is_system !== undefined)) {
      throw new BadRequestException('시스템 기본 역할의 코드나 시스템 설정은 변경할 수 없습니다.');
    }

    const oldValues = { ...role };
    
    Object.assign(role, updateRoleDto);
    const updatedRole = await this.roleRepository.save(role);

    // 감사 로그 기록
    await this.createAuditLog({
      admin_id: updatedBy,
      action: 'update_role',
      resource_type: 'admin_role',
      resource_id: roleId,
      old_values: oldValues,
      new_values: updateRoleDto
    });

    return updatedRole;
  }

  async deleteRole(roleId: number, deletedBy: number) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['user_roles']
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다.');
    }

    if (role.is_system) {
      throw new BadRequestException('시스템 기본 역할은 삭제할 수 없습니다.');
    }

    const activeUserRoles = role.user_roles?.filter(ur => ur.is_active) || [];
    if (activeUserRoles.length > 0) {
      throw new BadRequestException('해당 역할을 사용하는 사용자가 있어 삭제할 수 없습니다.');
    }

    const oldValues = { ...role };
    
    // 역할을 비활성화 (완전 삭제하지 않음)
    role.is_active = false;
    await this.roleRepository.save(role);

    // 감사 로그 기록
    await this.createAuditLog({
      admin_id: deletedBy,
      action: 'delete_role',
      resource_type: 'admin_role',
      resource_id: roleId,
      old_values: oldValues
    });

    return { success: true, message: '역할이 삭제되었습니다.' };
  }

  async getAllPermissions() {
    return await this.permissionService.getAllPermissions();
  }

  async getRolePermissions(roleId: number) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions']
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다.');
    }

    return {
      role,
      permissions: role.permissions || []
    };
  }

  async setRolePermissions(roleId: number, permissionIds: number[], updatedBy: number) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions']
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다.');
    }

    // 권한 존재 여부 확인
    if (permissionIds.length > 0) {
      const permissions = await this.permissionRepository.find({
        where: { id: In(permissionIds) }
      });

      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('존재하지 않는 권한이 포함되어 있습니다.');
      }
    }

    const oldPermissions = role.permissions?.map(p => p.id) || [];

    // 기존 권한 매핑 삭제
    await this.rolePermissionRepository.delete({ role_id: roleId });

    // 새로운 권한 매핑 생성
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map(permissionId => 
        this.rolePermissionRepository.create({
          role_id: roleId,
          permission_id: permissionId,
          granted_by: updatedBy
        })
      );

      await this.rolePermissionRepository.save(rolePermissions);
    }

    // 감사 로그 기록
    await this.createAuditLog({
      admin_id: updatedBy,
      action: 'update_role_permissions',
      resource_type: 'admin_role',
      resource_id: roleId,
      old_values: { permission_ids: oldPermissions },
      new_values: { permission_ids: permissionIds }
    });

    return { success: true, message: '역할 권한이 업데이트되었습니다.' };
  }

  async getAdminUsers(query: any = {}) {
    const { page = 1, limit = 20, search, roleId } = query;
    
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.user_roles', 'user_role', 'user_role.is_active = true')
      .leftJoinAndSelect('user_role.role', 'role')
      .where('user_role.id IS NOT NULL'); // 역할이 할당된 사용자만

    if (search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (roleId) {
      queryBuilder.andWhere('role.id = :roleId', { roleId });
    }

    const [users, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 권한 레벨별로 정렬 (낮은 권한부터)
    const sortedUsers = users.map(user => ({
      ...user,
      roles: user.user_roles?.map(ur => ur.role) || []
    })).sort((a, b) => {
      const aLevel = this.getUserPermissionLevel(a);
      const bLevel = this.getUserPermissionLevel(b);
      
      // 권한 레벨이 같으면 이름순 정렬
      if (aLevel === bLevel) {
        return a.name.localeCompare(b.name);
      }
      
      // 권한 레벨 낮은 순으로 정렬
      return aLevel - bLevel;
    });

    return {
      data: sortedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async assignUserRole(userId: number, roleId: number, assignedBy: number, expiresAt?: Date) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const role = await this.roleRepository.findOne({ where: { id: roleId } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다.');
    }

    const userRole = await this.permissionService.assignRole(userId, roleId, assignedBy);

    if (expiresAt) {
      userRole.expires_at = expiresAt;
      await this.userRoleRepository.save(userRole);
    }

    // 감사 로그 기록
    await this.createAuditLog({
      admin_id: assignedBy,
      target_user_id: userId,
      action: 'assign_user_role',
      resource_type: 'user_role',
      resource_id: userRole.id,
      new_values: { user_id: userId, role_id: roleId, expires_at: expiresAt }
    });

    return { success: true, message: '역할이 할당되었습니다.', userRole };
  }

  async revokeUserRole(userId: number, roleId: number, revokedBy: number) {
    const userRole = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId, is_active: true }
    });

    if (!userRole) {
      throw new NotFoundException('해당 사용자 역할을 찾을 수 없습니다.');
    }

    const success = await this.permissionService.revokeRole(userId, roleId);

    if (!success) {
      throw new BadRequestException('역할 해제에 실패했습니다.');
    }

    // 감사 로그 기록
    await this.createAuditLog({
      admin_id: revokedBy,
      target_user_id: userId,
      action: 'revoke_user_role',
      resource_type: 'user_role',
      resource_id: userRole.id,
      old_values: { user_id: userId, role_id: roleId }
    });

    return { success: true, message: '역할이 해제되었습니다.' };
  }

  // 사용자의 권한 레벨을 계산 (낮은 숫자가 높은 권한)
  private getUserPermissionLevel(user: any): number {
    // 기본 user_type 기반 레벨
    const userTypeLevel = this.getUserTypePriority(user.user_type);
    
    // 새로운 역할 시스템이 있으면 그것을 우선으로 사용
    if (user.roles && user.roles.length > 0) {
      const roleLevel = Math.min(...user.roles.map(role => this.getRolePriority(role.role_code)));
      return Math.min(userTypeLevel, roleLevel);
    }
    
    return userTypeLevel;
  }

  // user_type 기반 우선순위 (낮은 숫자가 높은 권한)
  private getUserTypePriority(userType: string): number {
    const priorities = {
      'super_admin': 1,
      'regional_manager': 2,
      'center_manager': 3,
      'staff': 4,
      'expert': 5,
      'general': 6
    };
    return priorities[userType] || 99;
  }

  // role_code 기반 우선순위 (낮은 숫자가 높은 권한)
  private getRolePriority(roleCode: string): number {
    const priorities = {
      'super_admin': 1,
      'regional_manager': 2,
      'center_manager': 3,
      'admin': 4,
      'cs_admin': 5,
      'content_admin': 6,
      'readonly_admin': 7
    };
    return priorities[roleCode] || 10;
  }

  async getUserPermissions(userId: number) {
    const userWithRoles = await this.permissionService.getUserWithRoles(userId);
    
    if (!userWithRoles) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return {
      user: {
        id: userWithRoles.id,
        name: userWithRoles.name,
        email: userWithRoles.email,
        user_type: userWithRoles.user_type
      },
      roles: userWithRoles.roles || [],
      permissions: userWithRoles.permissions || [],
      hasRoleSystem: (userWithRoles.roles && userWithRoles.roles.length > 0)
    };
  }

  async getAuditLogs(query: any = {}) {
    const { page = 1, limit = 20, adminId, targetUserId, action, startDate, endDate } = query;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.admin', 'admin')
      .leftJoinAndSelect('log.target_user', 'target_user');

    if (adminId) {
      queryBuilder.andWhere('log.admin_id = :adminId', { adminId });
    }

    if (targetUserId) {
      queryBuilder.andWhere('log.target_user_id = :targetUserId', { targetUserId });
    }

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }

    if (startDate) {
      queryBuilder.andWhere('log.created_at >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('log.created_at <= :endDate', { endDate });
    }

    const [logs, total] = await queryBuilder
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  private async createAuditLog(logData: Partial<AdminAuditLog>) {
    const auditLog = this.auditLogRepository.create(logData);
    await this.auditLogRepository.save(auditLog);
  }
}