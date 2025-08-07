import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    // JWT 토큰이 있으면 인증 처리, 없으면 그냥 통과
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // 에러가 있어도 인증을 선택사항으로 처리
    if (err || !user) {
      return null; // 인증 실패해도 null로 반환하여 계속 진행
    }
    return user;
  }
}