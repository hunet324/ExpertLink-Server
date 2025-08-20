import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/auth.interface';
import { UserType } from '../../entities/user.entity';

@Injectable()
export class ExpertGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user.userType !== UserType.EXPERT && ![UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER, UserType.CENTER_MANAGER, UserType.STAFF].includes(user.userType as UserType)) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    return true;
  }
}