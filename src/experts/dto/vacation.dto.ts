import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { VacationType, VacationStatus } from '../../entities/expert-vacation.entity';

export class CreateVacationDto {
  @IsNumber({}, { message: '전문가 ID는 숫자여야 합니다.' })
  @IsPositive({ message: '전문가 ID는 양수여야 합니다.' })
  @Transform(({ value }) => parseInt(value))
  expert_id: number;

  @IsDateString({}, { message: '시작일은 유효한 날짜 형식이어야 합니다.' })
  start_date: string;

  @IsDateString({}, { message: '종료일은 유효한 날짜 형식이어야 합니다.' })
  end_date: string;

  @IsEnum(VacationType, { message: '유효한 휴가 유형을 선택해주세요.' })
  @IsOptional()
  vacation_type?: VacationType = VacationType.ANNUAL;

  @IsNotEmpty({ message: '휴가 사유는 필수입니다.' })
  @IsString({ message: '휴가 사유는 문자열이어야 합니다.' })
  reason: string;
}

export class UpdateVacationStatusDto {
  @IsEnum(VacationStatus, { message: '유효한 상태를 선택해주세요.' })
  status: VacationStatus;

  @IsOptional()
  @IsString({ message: '거부 사유는 문자열이어야 합니다.' })
  rejection_reason?: string;
}

export class VacationQueryDto {
  @IsOptional()
  @IsNumber({}, { message: '전문가 ID는 숫자여야 합니다.' })
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  expert_id?: number;

  @IsOptional()
  @IsEnum(VacationStatus, { message: '유효한 상태를 선택해주세요.' })
  status?: VacationStatus;

  @IsOptional()
  @IsEnum(VacationType, { message: '유효한 휴가 유형을 선택해주세요.' })
  vacation_type?: VacationType;

  @IsOptional()
  @IsDateString({}, { message: '시작일은 유효한 날짜 형식이어야 합니다.' })
  start_date?: string;

  @IsOptional()
  @IsDateString({}, { message: '종료일은 유효한 날짜 형식이어야 합니다.' })
  end_date?: string;

  @IsOptional()
  @IsNumber({}, { message: '페이지는 숫자여야 합니다.' })
  @Transform(({ value }) => value ? parseInt(value) : 1)
  page?: number = 1;

  @IsOptional()
  @IsNumber({}, { message: '제한 수는 숫자여야 합니다.' })
  @Transform(({ value }) => value ? parseInt(value) : 20)
  limit?: number = 20;
}

export class VacationResponseDto {
  id: number;
  expert_id: number;
  expert_name: string;
  expert_email: string;
  approved_by: number;
  approver_name: string;
  start_date: string;
  end_date: string;
  vacation_type: VacationType;
  status: VacationStatus;
  reason: string;
  rejection_reason: string;
  approved_at: string;
  created_at: string;
  updated_at: string;
}

export class VacationListResponseDto {
  vacations: VacationResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}