import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RedisService } from '../config/redis.config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserStatus } from '../entities/user.entity';

export interface JwtPayload {
  sub: number;
  email: string;
  user_type: string;
}

export interface AuthResponse {
  user: Partial<User>;
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create(registerDto);
    
    const tokens = await this.generateTokens(user);
    
    // Refresh token을 Redis에 저장
    await this.redisService.set(
      `refresh_token:${user.id}`,
      tokens.refresh_token,
      7 * 24 * 60 * 60 // 7일
    );

    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;
    
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다.');
    }

    if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING) {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    const isPasswordValid = await this.usersService.validatePassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다.');
    }

    const tokens = await this.generateTokens(user);
    
    // Refresh token을 Redis에 저장
    await this.redisService.set(
      `refresh_token:${user.id}`,
      tokens.refresh_token,
      7 * 24 * 60 * 60 // 7일
    );

    // 로그인 기록을 Redis에 저장 (온라인 상태)
    await this.redisService.setAdd('online_users', user.id.toString());

    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  async logout(userId: number): Promise<void> {
    // Redis에서 refresh token 삭제
    await this.redisService.delete(`refresh_token:${userId}`);
    
    // 온라인 사용자 목록에서 제거
    await this.redisService.setRemove('online_users', userId.toString());
  }

  async refreshTokens(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
      }

      // Redis에서 refresh token 확인
      const storedToken = await this.redisService.get(`refresh_token:${user.id}`);
      if (storedToken !== refreshToken) {
        throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
      }

      const tokens = await this.generateTokens(user);
      
      // 새로운 refresh token을 Redis에 저장
      await this.redisService.set(
        `refresh_token:${user.id}`,
        tokens.refresh_token,
        7 * 24 * 60 * 60 // 7일
      );

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }
  }

  private async generateTokens(user: User): Promise<{ access_token: string; refresh_token: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      user_type: user.user_type,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { access_token, refresh_token };
  }
}