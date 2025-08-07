import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../entities/user.entity';

export class AuthResponseDto {
  @ApiProperty({ 
    description: '사용자 정보',
    type: () => UserResponseDto
  })
  user: Partial<User>;

  @ApiProperty({ 
    description: 'JWT Access Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  access_token: string;

  @ApiProperty({ 
    description: 'JWT Refresh Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refresh_token: string;
}

export class UserResponseDto {
  @ApiProperty({ description: '사용자 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '사용자 이름', example: '홍길동' })
  name: string;

  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: '전화번호', example: '010-1234-5678', required: false })
  phone?: string;

  @ApiProperty({ description: '사용자 유형', example: 'general' })
  user_type: string;

  @ApiProperty({ description: '계정 상태', example: 'active' })
  status: string;

  @ApiProperty({ description: '프로필 이미지 URL', required: false })
  profile_image?: string;

  @ApiProperty({ description: '자기소개', required: false })
  bio?: string;

  @ApiProperty({ description: '가입일', example: '2024-01-01T00:00:00.000Z' })
  signup_date: Date;

  @ApiProperty({ description: '생성일', example: '2024-01-01T00:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ description: '수정일', example: '2024-01-01T00:00:00.000Z' })
  updated_at: Date;
}