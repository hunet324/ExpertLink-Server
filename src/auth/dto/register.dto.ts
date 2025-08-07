import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '../../entities/user.entity';

export class RegisterDto {
  @ApiProperty({ 
    description: '사용자 이름', 
    example: '홍길동',
    minLength: 2,
    maxLength: 100
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ 
    description: '이메일 주소', 
    example: 'user@example.com',
    maxLength: 255
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ 
    description: '비밀번호 (최소 8자)', 
    example: 'password123',
    minLength: 8,
    maxLength: 255
  })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password: string;

  @ApiProperty({ 
    description: '전화번호 (선택사항)', 
    example: '010-1234-5678',
    required: false,
    maxLength: 20
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ 
    description: '사용자 유형', 
    enum: UserType,
    example: UserType.GENERAL,
    default: UserType.GENERAL,
    required: false
  })
  @IsOptional()
  @IsEnum(UserType)
  user_type?: UserType = UserType.GENERAL;
}