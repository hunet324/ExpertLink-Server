import { Type } from 'class-transformer';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExpertVerificationDto {
  @ApiProperty({
    description: '전문가 승인 여부',
    example: true,
    type: 'boolean'
  })
  @IsBoolean()
  isVerified: boolean;

  @ApiProperty({
    description: '승인/거절 사유 또는 참고사항',
    example: '관리자에 의한 승인 처리',
    required: false
  })
  @IsOptional()
  @IsString()
  verificationNote?: string; // 승인/거절 사유
}

export class ExpertVerificationResponseDto {
  @ApiProperty({ description: '처리 결과 메시지', example: '전문가가 승인되었습니다.' })
  message: string;

  @ApiProperty({ description: '전문가 프로필 ID', example: 2 })
  expert_id: number;

  @ApiProperty({ description: '전문가 이름', example: '김전문가' })
  expert_name: string;

  @ApiProperty({ description: '승인 여부', example: true })
  is_verified: boolean;

  @ApiProperty({ description: '승인/거절 사유', example: '관리자에 의한 승인 처리', required: false })
  verification_note?: string;

  @ApiProperty({ description: '승인/거절 처리 시간', example: '2024-01-15T09:30:00Z' })
  @Type(() => Date)
  verification_date: Date;

  @ApiProperty({ description: '승인한 관리자 ID', example: 1 })
  verified_by: number; // 승인한 관리자 ID
}

export class PendingExpertDto {
  id: number | null; // 일반 사용자의 경우 null
  user_id: number;
  user_name: string;
  user_email: string;
  user_type: string; // 사용자 타입 (general, expert, admin)
  user_status: string; // 사용자 상태 (pending, active, inactive, withdrawn)
  specialization?: string[];
  license_number?: string;
  license_type?: string;
  years_experience?: number;
  education?: string;
  career_history?: string;
  introduction?: string;
  hourly_rate?: number;
  @Type(() => Date)
  created_at: Date;
  verification_documents?: string[]; // 첨부 서류 URL들
  is_expert_profile: boolean; // 전문가 프로필 여부
}

export class PendingExpertsListDto {
  @Type(() => PendingExpertDto)
  experts: PendingExpertDto[];
  total: number;
  pending_count: number;
}