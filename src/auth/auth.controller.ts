import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService, AuthResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';

@ApiTags('🔐 auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '회원가입', description: '새로운 사용자를 등록합니다.' })
  @ApiResponse({ status: 201, description: '회원가입 성공', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 409, description: '이미 존재하는 이메일' })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return await this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: '로그인', description: '이메일과 비밀번호로 로그인합니다.' })
  @ApiResponse({ status: 200, description: '로그인 성공', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: '인증 실패 (이메일 또는 비밀번호 오류)' })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return await this.authService.login(loginDto);
  }

  @Post('logout')
  @ApiOperation({ summary: '로그아웃', description: '현재 사용자를 로그아웃합니다.' })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    await this.authService.logout(req.user.userId);
    return { message: '로그아웃 되었습니다.' };
  }

  @Post('refresh')
  @ApiOperation({ summary: '토큰 갱신', description: 'Refresh token을 사용해 새로운 Access token을 발급받습니다.' })
  @ApiResponse({ status: 200, description: '토큰 갱신 성공' })
  @ApiResponse({ status: 401, description: '유효하지 않은 refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: {
          type: 'string',
          description: 'Refresh Token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refresh_token') refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    return await this.authService.refreshTokens(refreshToken);
  }
}