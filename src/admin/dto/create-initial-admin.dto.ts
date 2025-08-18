import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInitialAdminDto {
  @ApiProperty({ description: '관리자 이메일', example: 'admin@example.com' })
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({ description: '관리자 비밀번호', example: 'admin123!' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  @MaxLength(20, { message: '비밀번호는 최대 20자 이하여야 합니다.' })
  password: string;

  @ApiProperty({ description: '관리자 이름', example: '초기 관리자' })
  @IsString({ message: '이름은 문자열이어야 합니다.' })
  name: string;

  @ApiProperty({ description: '관리자 전화번호', example: '010-1234-5678', required: false })
  @IsString({ message: '전화번호는 문자열이어야 합니다.' })
  phone?: string;
}