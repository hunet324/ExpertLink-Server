import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../services/permission.service';

// 메타데이터 키 정의
export const PERMISSION_KEY = 'permission';
export const PERMISSIONS_KEY = 'permissions';
export const PERMISSION_SCOPE_KEY = 'permission_scope';

// 데코레이터 정의
export const RequirePermission = (permission: string, options?: { scope?: 'global' | 'center' }) => {
  const decorators = [SetMetadata(PERMISSION_KEY, permission)];
  if (options?.scope) {
    decorators.push(SetMetadata(PERMISSION_SCOPE_KEY, options.scope));
  }
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    decorators.forEach(decorator => decorator(target, propertyKey, descriptor));
  };
};

export const RequirePermissions = (permissions: string[], requireAll: boolean = false) => 
  SetMetadata(PERMISSIONS_KEY, { permissions, requireAll });

export const RequireAnyPermission = (...permissions: string[]) => 
  RequirePermissions(permissions, false);

export const RequireAllPermissions = (...permissions: string[]) => 
  RequirePermissions(permissions, true);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // 1. 단일 권한 체크
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (permission) {
      const hasPermission = await this.permissionService.hasPermission(user.id, permission);
      if (!hasPermission) {
        throw new ForbiddenException(`필요한 권한: ${permission}`);
      }

      // 범위 체크 (센터 단위 제한)
      const scope = this.reflector.getAllAndOverride<string>(PERMISSION_SCOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (scope === 'center') {
        return this.checkCenterScope(user, request);
      }

      return true;
    }

    // 2. 복수 권한 체크
    const permissionsConfig = this.reflector.getAllAndOverride<{ permissions: string[], requireAll: boolean }>(
      PERMISSIONS_KEY, 
      [context.getHandler(), context.getClass()]
    );

    if (permissionsConfig) {
      const { permissions, requireAll } = permissionsConfig;
      
      const hasPermissions = requireAll
        ? await this.permissionService.hasAllPermissions(user.id, permissions)
        : await this.permissionService.hasAnyPermission(user.id, permissions);

      if (!hasPermissions) {
        const requiredText = requireAll ? '모든' : '일부';
        throw new ForbiddenException(`필요한 권한 (${requiredText}): ${permissions.join(', ')}`);
      }

      return true;
    }

    // 권한 요구사항이 없는 경우 통과
    return true;
  }

  private checkCenterScope(user: any, request: any): boolean {
    // 최고 관리자와 지역 관리자는 모든 센터 접근 가능
    if (['super_admin', 'regional_manager'].includes(user.user_type)) {
      return true;
    }

    // 센터 ID 추출
    const targetCenterId = this.extractCenterIdFromRequest(request);
    
    if (!targetCenterId) {
      // 센터 ID가 없는 요청은 자신의 센터 데이터만 접근 가능한 것으로 간주
      return true;
    }

    if (!user.center_id) {
      throw new ForbiddenException('소속 센터가 설정되지 않았습니다.');
    }

    if (user.center_id !== targetCenterId) {
      throw new ForbiddenException('다른 센터의 데이터에 접근할 수 없습니다.');
    }

    return true;
  }

  private extractCenterIdFromRequest(request: any): number | null {
    // URL 파라미터에서 centerId 추출
    if (request.params?.centerId) {
      return parseInt(request.params.centerId);
    }

    // 쿼리 파라미터에서 centerId 추출  
    if (request.query?.centerId) {
      return parseInt(request.query.centerId);
    }

    // 바디에서 centerId 추출
    if (request.body?.centerId) {
      return parseInt(request.body.centerId);
    }

    return null;
  }
}