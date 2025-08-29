import { ApiProperty } from '@nestjs/swagger';

export class PasswordInfoResponseDto {
  @ApiProperty({
    description: '사용자 ID'
  })
  id: number;

  @ApiProperty({
    description: '사용자 이름'
  })
  name: string;

  @ApiProperty({
    description: '사용자 이메일'
  })
  email: string;

  @ApiProperty({
    description: '사용자 역할'
  })
  role: string;

  @ApiProperty({
    description: '최근 비밀번호 변경일'
  })
  lastPasswordChange: string;

  @ApiProperty({
    description: '총 로그인 횟수'
  })
  loginCount: number;

  @ApiProperty({
    description: '최근 로그인 시간'
  })
  lastLogin?: string;

  @ApiProperty({
    description: '비밀번호 변경 경과 일수'
  })
  daysSinceLastChange: number;

  @ApiProperty({
    description: '비밀번호 변경 권장 여부'
  })
  isPasswordExpiringSoon: boolean;
}