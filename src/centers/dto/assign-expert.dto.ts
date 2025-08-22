import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class AssignExpertDto {
  @ApiProperty({
    description: '배정할 전문가의 사용자 ID',
    example: 4,
    type: Number
  })
  @IsOptional()
  @IsNumber({}, { message: '사용자 ID는 숫자여야 합니다.' })
  @IsPositive({ message: '사용자 ID는 양수여야 합니다.' })
  userId?: number;

  // 실제로는 변환 후 이것이 사용됨
  @IsNotEmpty({ message: '사용자 ID는 필수입니다.' })
  @IsNumber({}, { message: '사용자 ID는 숫자여야 합니다.' })
  @IsPositive({ message: '사용자 ID는 양수여야 합니다.' })
  user_id: number;
}