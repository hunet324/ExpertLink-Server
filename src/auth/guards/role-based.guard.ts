import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType, AdminLevel } from '../../entities/user.entity';

// 권한 레벨 정의 (숫자가 높을수록 높은 권한)
export const PERMISSION_LEVELS = {
  [UserType.GENERAL]: 0,
  [UserType.EXPERT]: 1,
  [UserType.STAFF]: 2,
  [UserType.CENTER_MANAGER]: 3,
  [UserType.REGIONAL_MANAGER]: 4,
  [UserType.SUPER_ADMIN]: 5,
} as const;

// 데코레이터 정의
export const ROLES_KEY = 'roles';
export const MIN_ROLE_KEY = 'minRole';
export const SAME_CENTER_KEY = 'sameCenter';

export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
export const MinRole = (role: UserType) => SetMetadata(MIN_ROLE_KEY, role);
export const SameCenterOnly = () => SetMetadata(SAME_CENTER_KEY, true);

@Injectable()
export class RoleBasedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // 1. 특정 역할 체크
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles) {
      const hasRole = requiredRoles.includes(user.user_type);
      if (!hasRole) {
        throw new ForbiddenException(`필요한 권한: ${requiredRoles.join(', ')}`);
      }
    }

    // 2. 최소 권한 레벨 체크
    const minRole = this.reflector.getAllAndOverride<UserType>(MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (minRole) {
      const userLevel = PERMISSION_LEVELS[user.user_type] || 0;
      const requiredLevel = PERMISSION_LEVELS[minRole];
      
      if (userLevel < requiredLevel) {
        throw new ForbiddenException(`최소 ${minRole} 권한이 필요합니다.`);
      }
    }

    // 3. 같은 센터 내 접근만 허용 체크
    const sameCenterOnly = this.reflector.getAllAndOverride<boolean>(SAME_CENTER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (sameCenterOnly && user.user_type !== UserType.SUPER_ADMIN && user.user_type !== UserType.REGIONAL_MANAGER) {
      const targetCenterId = this.extractCenterIdFromRequest(request);
      
      if (targetCenterId && user.center_id && user.center_id !== targetCenterId) {
        throw new ForbiddenException('다른 센터의 데이터에 접근할 수 없습니다.');
      }
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