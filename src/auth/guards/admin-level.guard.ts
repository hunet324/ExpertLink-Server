import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserType } from '../../entities/user.entity';

// 특정 관리자 등급별 전용 가드들

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    if (user.user_type !== UserType.SUPER_ADMIN) {
      throw new ForbiddenException('최고 관리자 권한이 필요합니다.');
    }

    return true;
  }
}

@Injectable()
export class RegionalManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    if (![UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER].includes(user.user_type)) {
      throw new ForbiddenException('지역 관리자 이상의 권한이 필요합니다.');
    }

    return true;
  }
}

@Injectable()
export class CenterManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    if (![UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER, UserType.CENTER_MANAGER].includes(user.user_type)) {
      throw new ForbiddenException('센터장 이상의 권한이 필요합니다.');
    }

    return true;
  }
}

@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    if (![UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER, UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type)) {
      throw new ForbiddenException('직원 이상의 권한이 필요합니다.');
    }

    return true;
  }
}

// 센터별 권한 제어가 포함된 가드
@Injectable()
export class CenterScopedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // 최고 관리자와 지역 관리자는 모든 센터 접근 가능
    if ([UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER].includes(user.user_type)) {
      return true;
    }

    // 센터장과 직원은 자신의 센터만 접근 가능
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type)) {
      const targetCenterId = this.extractCenterIdFromRequest(request);
      
      if (!user.center_id) {
        throw new ForbiddenException('소속 센터가 설정되지 않았습니다.');
      }

      if (targetCenterId && user.center_id !== targetCenterId) {
        throw new ForbiddenException('자신의 센터 데이터만 접근할 수 있습니다.');
      }

      return true;
    }

    throw new ForbiddenException('관리자 권한이 필요합니다.');
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