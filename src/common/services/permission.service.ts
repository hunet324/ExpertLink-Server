import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AdminRole } from '../../entities/admin-role.entity';
import { AdminPermission } from '../../entities/admin-permission.entity';
import { UserRole } from '../../entities/user-role.entity';
import { User, UserType } from '../../entities/user.entity';

export interface UserWithRoles extends User {
  user_roles?: UserRole[];
  roles?: AdminRole[];
  permissions?: AdminPermission[];
}

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(AdminRole)
    private roleRepository: Repository<AdminRole>,
    
    @InjectRepository(AdminPermission)
    private permissionRepository: Repository<AdminPermission>,
    
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  /**
   * 사용자의 모든 역할과 권한을 조회
   */
  async getUserWithRoles(userId: number): Promise<UserWithRoles | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['user_roles', 'user_roles.role', 'user_roles.role.permissions']
    });

    if (!user) return null;

    // 활성화된 역할만 필터링
    const activeUserRoles = user.user_roles?.filter(ur => 
      ur.is_active && 
      (!ur.expires_at || ur.expires_at > new Date())
    );

    const roles = activeUserRoles?.map(ur => ur.role) || [];
    const permissions = this.extractUniquePermissions(roles);

    return {
      ...user,
      user_roles: activeUserRoles,
      roles,
      permissions
    };
  }

  /**
   * 사용자가 특정 권한을 가지고 있는지 확인
   */
  async hasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const user = await this.getUserWithRoles(userId);
    
    if (!user) return false;

    // 새로운 역할 시스템이 있는 경우
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.some(p => p.permission_code === permissionCode);
    }

    // 기존 user_type으로 폴백
    return this.checkLegacyPermission(user.user_type, permissionCode);
  }

  /**
   * 사용자가 여러 권한 중 하나라도 가지고 있는지 확인
   */
  async hasAnyPermission(userId: number, permissionCodes: string[]): Promise<boolean> {
    const user = await this.getUserWithRoles(userId);
    
    if (!user) return false;

    // 새로운 역할 시스템이 있는 경우
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.some(p => permissionCodes.includes(p.permission_code));
    }

    // 기존 user_type으로 폴백
    return permissionCodes.some(code => this.checkLegacyPermission(user.user_type, code));
  }

  /**
   * 사용자가 모든 권한을 가지고 있는지 확인
   */
  async hasAllPermissions(userId: number, permissionCodes: string[]): Promise<boolean> {
    const user = await this.getUserWithRoles(userId);
    
    if (!user) return false;

    // 새로운 역할 시스템이 있는 경우
    if (user.permissions && user.permissions.length > 0) {
      const userPermissionCodes = user.permissions.map(p => p.permission_code);
      return permissionCodes.every(code => userPermissionCodes.includes(code));
    }

    // 기존 user_type으로 폴백
    return permissionCodes.every(code => this.checkLegacyPermission(user.user_type, code));
  }

  /**
   * 사용자에게 역할 할당
   */
  async assignRole(userId: number, roleId: number, assignedBy: number): Promise<UserRole> {
    // 기존 역할이 있는지 확인
    const existingRole = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId }
    });

    if (existingRole) {
      // 기존 역할이 비활성화되어 있으면 활성화
      if (!existingRole.is_active) {
        existingRole.is_active = true;
        existingRole.assigned_by = assignedBy;
        existingRole.assigned_at = new Date();
        return await this.userRoleRepository.save(existingRole);
      }
      return existingRole;
    }

    // 새로운 역할 할당
    const userRole = this.userRoleRepository.create({
      user_id: userId,
      role_id: roleId,
      assigned_by: assignedBy,
      is_active: true
    });

    return await this.userRoleRepository.save(userRole);
  }

  /**
   * 사용자에게서 역할 제거
   */
  async revokeRole(userId: number, roleId: number): Promise<boolean> {
    const userRole = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId, is_active: true }
    });

    if (!userRole) return false;

    userRole.is_active = false;
    await this.userRoleRepository.save(userRole);
    return true;
  }

  /**
   * 모든 역할 조회
   */
  async getAllRoles(): Promise<AdminRole[]> {
    return await this.roleRepository.find({
      where: { is_active: true },
      relations: ['permissions'],
      order: { name: 'ASC' }
    });
  }

  /**
   * 모든 권한 조회 (카테고리별 그룹화)
   */
  async getAllPermissions(): Promise<{ [category: string]: AdminPermission[] }> {
    const permissions = await this.permissionRepository.find({
      order: { category: 'ASC', name: 'ASC' }
    });

    return permissions.reduce((groups, permission) => {
      const category = permission.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(permission);
      return groups;
    }, {} as { [category: string]: AdminPermission[] });
  }

  /**
   * 역할들에서 고유한 권한들만 추출
   */
  private extractUniquePermissions(roles: AdminRole[]): AdminPermission[] {
    const permissionMap = new Map<number, AdminPermission>();
    
    roles.forEach(role => {
      if (role.permissions) {
        role.permissions.forEach(permission => {
          permissionMap.set(permission.id, permission);
        });
      }
    });

    return Array.from(permissionMap.values());
  }

  /**
   * 기존 user_type 기반 권한 체크 (폴백용)
   */
  private checkLegacyPermission(userType: UserType, permissionCode: string): boolean {
    const legacyPermissionMap: { [key in UserType]: string[] } = {
      [UserType.SUPER_ADMIN]: [
        'user_view', 'user_manage', 'expert_view', 'expert_manage',
        'payment_view', 'payment_manage', 'content_view', 'content_manage',
        'stats_view', 'system_view', 'system_manage', 'admin_manage'
      ],
      [UserType.REGIONAL_MANAGER]: [
        'user_view', 'user_manage', 'expert_view', 'expert_manage',
        'payment_view', 'payment_manage', 'content_view', 'content_manage',
        'stats_view', 'system_view'
      ],
      [UserType.CENTER_MANAGER]: [
        'user_view', 'user_manage', 'expert_view', 'expert_manage',
        'payment_view', 'payment_manage', 'content_view', 'content_manage',
        'stats_view', 'system_view'
      ],
      [UserType.STAFF]: [
        'user_view', 'expert_view', 'payment_view', 'content_view', 'stats_view'
      ],
      [UserType.EXPERT]: [],
      [UserType.GENERAL]: []
    };

    return legacyPermissionMap[userType]?.includes(permissionCode) || false;
  }
}