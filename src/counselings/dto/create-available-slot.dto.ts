import { IsDateString, IsOptional, IsEnum, IsNumber, IsString, Min, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CounselingType } from '../../entities/counseling.entity';

export class CreateAvailableSlotDto {
  @ApiProperty({ description: '상담 날짜 (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: '시작 시간 (HH:MM:SS)' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: '시작 시간은 HH:MM:SS 형식이어야 합니다.'
  })
  startTime: string;

  @ApiProperty({ description: '종료 시간 (HH:MM:SS)' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: '종료 시간은 HH:MM:SS 형식이어야 합니다.'
  })
  endTime: string;

  @ApiProperty({ description: '상담 시간 (분)', default: 60 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  duration?: number;

  @ApiProperty({ description: '상담 타입', enum: CounselingType, default: CounselingType.VIDEO })
  @IsOptional()
  @IsEnum(CounselingType)
  type?: CounselingType;

  @ApiProperty({ description: '슬롯 제목', required: false })
  @IsOptional()
  @IsString()
  title?: string;
}

export class CreateAvailableSlotsDto {
  @ApiProperty({ description: '생성할 슬롯 목록', type: [CreateAvailableSlotDto] })
  slots: CreateAvailableSlotDto[];
}