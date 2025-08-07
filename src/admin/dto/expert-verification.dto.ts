import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class ExpertVerificationDto {
  @IsBoolean()
  is_verified: boolean;

  @IsOptional()
  @IsString()
  verification_note?: string; // 승인/거절 사유
}

export class ExpertVerificationResponseDto {
  @Expose()
  message: string;

  @Expose()
  expert_id: number;

  @Expose()
  expert_name: string;

  @Expose()
  is_verified: boolean;

  @Expose()
  verification_note?: string;

  @Expose()
  @Type(() => Date)
  verification_date: Date;

  @Expose()
  verified_by: number; // 승인한 관리자 ID
}

export class PendingExpertDto {
  @Expose()
  id: number;

  @Expose()
  user_id: number;

  @Expose()
  user_name: string;

  @Expose()
  user_email: string;

  @Expose()
  specialization: string[];

  @Expose()
  license_number?: string;

  @Expose()
  license_type?: string;

  @Expose()
  years_experience?: number;

  @Expose()
  education?: string;

  @Expose()
  career_history?: string;

  @Expose()
  introduction?: string;

  @Expose()
  hourly_rate?: number;

  @Expose()
  @Type(() => Date)
  created_at: Date;

  @Expose()
  verification_documents?: string[]; // 첨부 서류 URL들
}

export class PendingExpertsListDto {
  @Expose()
  @Type(() => PendingExpertDto)
  experts: PendingExpertDto[];

  @Expose()
  total: number;

  @Expose()
  pending_count: number;
}