import { Injectable, UnauthorizedException, BadRequestException, Inject, Scope } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import { RedisService } from '../config/redis.config';
import { SystemLogService } from '../common/services/system-log.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User, UserStatus } from '../entities/user.entity';

export interface JwtPayload {
  sub: number;
  email: string;
  user_type: string;
}

export interface AuthResponse {
  user: Partial<User>;
  accessToken: string;
  refreshToken: string;
}

@Injectable({ scope: Scope.REQUEST })
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private systemLogService: SystemLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create(registerDto);
    
    const tokens = await this.generateTokens(user);
    
    // Refresh token을 Redis에 저장
    await this.redisService.set(
      `refresh_token:${user.id}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60 // 7일
    );

    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
      tokens.refreshToken,
      7 * 24 * 60 * 60 // 7일
    );

    // 로그인 기록을 Redis에 저장 (온라인 상태)
    await this.redisService.setAdd('online_users', user.id.toString());

    // 로그인 시스템 로그 기록
    const clientIp = this.request.ip || this.request.connection.remoteAddress || 'unknown';
    const userAgent = this.request.get('User-Agent') || 'unknown';
    
    await this.systemLogService.logUserLogin(
      user.id,
      user.name,
      user.user_type,
      clientIp,
      userAgent
    );

    // 로그인 정보 업데이트
    await this.usersService.updateLoginInfo(user.id);

    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: number): Promise<void> {
    // Redis에서 refresh token 삭제
    await this.redisService.delete(`refresh_token:${userId}`);
    
    // 온라인 사용자 목록에서 제거
    await this.redisService.setRemove('online_users', userId.toString());
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
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
        tokens.refreshToken,
        7 * 24 * 60 * 60 // 7일
      );

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      user_type: user.user_type,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto): Promise<{ success: boolean; message: string }> {
    const { current_password: currentPassword, new_password: newPassword } = changePasswordDto;
    
    await this.usersService.changePassword(userId, currentPassword, newPassword);

    // 현재 요청의 토큰 정보 추출
    const currentAuthHeader = this.request.get('Authorization');
    let currentRefreshToken: string | null = null;
    
    if (currentAuthHeader) {
      try {
        const currentAccessToken = currentAuthHeader.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(currentAccessToken.split('.')[1], 'base64').toString());
        
        // 현재 사용자의 refresh token 조회
        currentRefreshToken = await this.redisService.get(`refresh_token:${userId}`);
      } catch (error) {
        console.warn('현재 토큰 정보 추출 실패:', error);
      }
    }

    // 비밀번호 변경 후 기존 refresh token 무효화
    await this.redisService.delete(`refresh_token:${userId}`);
    
    // 현재 세션 유지를 위해 새로운 토큰 생성 및 저장
    if (currentRefreshToken) {
      const user = await this.usersService.findById(userId);
      const newTokens = await this.generateTokens(user);
      
      await this.redisService.set(
        `refresh_token:${userId}`,
        newTokens.refreshToken,
        7 * 24 * 60 * 60 // 7일
      );
    }
    
    // 비밀번호 변경 로그 기록
    const user = await this.usersService.findById(userId);
    const clientIp = this.request.ip || this.request.connection.remoteAddress || 'unknown';
    const userAgent = this.request.get('User-Agent') || 'unknown';
    
    await this.systemLogService.logPasswordChange(
      userId,
      user.name,
      user.user_type,
      clientIp,
      userAgent
    );

    return {
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    };
  }

  async getPasswordInfo(userId: number) {
    return await this.usersService.getPasswordInfo(userId);
  }
}