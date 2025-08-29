import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: '현재 비밀번호',
    example: 'currentPassword123!'
  })
  @IsNotEmpty({ message: '현재 비밀번호를 입력해주세요.' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: '새 비밀번호',
    example: 'newPassword123!',
    minLength: 8
  })
  @IsNotEmpty({ message: '새 비밀번호를 입력해주세요.' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/,
    {
      message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.'
    }
  )
  newPassword: string;
}