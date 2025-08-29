import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionService } from '../../common/services/permission.service';
import { UserType } from '../../entities/user.entity';

/**
 * 하이브리드 관리자 가드
 * 새로운 역할 시스템과 기존 user_type 시스템을 모두 지원
 */
@Injectable()
export class HybridAdminGuard implements CanActivate {
  constructor(private permissionService: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // 1. 새로운 역할 시스템 먼저 확인
    const userWithRoles = await this.permissionService.getUserWithRoles(user.id);
    
    if (userWithRoles && userWithRoles.roles && userWithRoles.roles.length > 0) {
      // 새로운 역할 시스템이 설정되어 있는 경우
      // 최소한 하나의 관리 권한이 있는지 확인
      const hasAnyAdminPermission = await this.permissionService.hasAnyPermission(user.id, [
        'user_view', 'expert_view', 'payment_view', 'content_view', 
        'stats_view', 'system_view', 'admin_manage'
      ]);
      
      if (!hasAnyAdminPermission) {
        throw new ForbiddenException('관리자 권한이 필요합니다.');
      }
      
      return true;
    }

    // 2. 기존 user_type 시스템으로 폴백
    const adminTypes = [UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER, UserType.CENTER_MANAGER, UserType.STAFF];
    
    if (!adminTypes.includes(user.user_type as UserType)) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }

    return true;
  }
}