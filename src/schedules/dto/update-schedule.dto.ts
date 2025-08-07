import { IsString, IsOptional, IsDateString, Matches, MaxLength, IsEnum } from 'class-validator';
import { ScheduleStatus } from '../../entities/schedule.entity';

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsDateString()
  schedule_date?: string; // YYYY-MM-DD 형식

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: '시간 형식이 올바르지 않습니다. HH:MM 형식으로 입력해주세요.',
  })
  start_time?: string; // HH:MM 형식

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: '시간 형식이 올바르지 않습니다. HH:MM 형식으로 입력해주세요.',
  })
  end_time?: string; // HH:MM 형식

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}