import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: '이메일 주소', 
    example: 'user@example.com'
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: '비밀번호', 
    example: 'password123',
    minLength: 8
  })
  @IsString()
  @MinLength(8)
  password: string;
}