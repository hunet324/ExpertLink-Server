import { IsString, IsNumber, IsNotEmpty, MaxLength, Min, IsOptional, IsEnum, IsDateString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CounselingType } from '../../entities/counseling.entity';

export class CreateCounselingDto {
  @ApiProperty({ description: '전문가 ID', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expert_id?: number;

  @ApiProperty({ description: '슬롯 ID (새로운 방식)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  slot_id?: number;

  @ApiProperty({ description: '일정 ID (레거시)', required: false, deprecated: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  schedule_id?: number;

  @ApiProperty({ description: '상담 신청 사유' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiProperty({ description: '상담 타입', enum: CounselingType, default: CounselingType.VIDEO })
  @IsOptional()
  @IsEnum(CounselingType)
  type?: CounselingType;

  @ApiProperty({ description: '희망 날짜 (슬롯이 없는 경우)', required: false })
  @IsOptional()
  @IsDateString()
  preferred_date?: string;

  @ApiProperty({ description: '희망 시작 시간', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: '희망 시작 시간은 HH:MM:SS 형식이어야 합니다.'
  })
  preferred_start_time?: string;

  @ApiProperty({ description: '희망 종료 시간', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: '희망 종료 시간은 HH:MM:SS 형식이어야 합니다.'
  })
  preferred_end_time?: string;

  @ApiProperty({ description: '상담 시간 (분)', default: 60 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  duration?: number;
}