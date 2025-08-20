import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.service';
import { AuthenticatedUser } from '../common/interfaces/auth.interface';
import { UserType } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    // 양쪽 형식을 모두 지원하는 사용자 객체 생성
    const authUser: AuthenticatedUser = {
      userId: payload.sub,
      id: payload.sub, // userId의 별칭
      email: payload.email || user.email,
      name: user.name,
      userType: user.user_type, // string 형태
      user_type: user.user_type as UserType, // enum 형태
      centerId: user.center_id,
      center_id: user.center_id, // centerId의 별칭
      supervisorId: user.supervisor_id,
      supervisor_id: user.supervisor_id, // supervisorId의 별칭
    };

    return authUser;
  }
}