import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BookSlotDto {
  @ApiProperty({ description: '상담 신청 사유' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}