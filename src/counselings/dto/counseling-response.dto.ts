import { Expose, Transform, Type } from 'class-transformer';
import { CounselingStatus, PaymentStatus, CounselingType } from '../../entities/counseling.entity';

class UserInfoDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  profile_image: string;
}

class ExpertInfoDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  profile_image: string;

  @Expose()
  specialization: string[];
}

export class CounselingResponseDto {
  @Expose()
  id: number;

  @Expose()
  user_id: number;

  @Expose()
  expert_id: number;

  // 통합 상담 시스템 필드들
  @Expose()
  schedule_date: Date;

  @Expose()
  start_time: string;

  @Expose()
  end_time: string;

  @Expose()
  duration: number;

  @Expose()
  title: string;

  @Expose()
  notes: string;

  @Expose()
  type: CounselingType;

  @Expose()
  status: CounselingStatus;

  @Expose()
  reason: string;

  @Expose()
  request_date: Date;

  @Expose()
  appointment_date: Date;

  @Expose()
  session_notes: string;

  @Expose()
  user_feedback: string;

  @Expose()
  rating: number;

  @Expose()
  payment_amount: number;

  @Expose()
  payment_status: PaymentStatus;

  @Expose()
  actual_start_time: Date;

  @Expose()
  actual_end_time: Date;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  // 관계된 데이터
  @Expose()
  @Type(() => UserInfoDto)
  user: UserInfoDto;

  @Expose()
  @Type(() => ExpertInfoDto)
  expert: ExpertInfoDto;

  // 프론트엔드 호환성을 위한 계산 필드들
  @Expose()
  @Transform(({ obj }) => obj.schedule_date)
  scheduleDate: string;

  @Expose()
  @Transform(({ obj }) => obj.start_time)
  startTime: string;

  @Expose()
  @Transform(({ obj }) => obj.end_time)
  endTime: string;

  @Expose()
  @Transform(({ obj }) => obj.type)
  scheduleType: string;

  @Expose()
  @Transform(({ obj }) => obj.user?.name || '가용 슬롯')
  clientName: string;

  @Expose()
  @Transform(({ obj }) => obj.user?.id)
  clientId: number;

  // 대시보드용 time 필드 (start_time-end_time 형식)
  @Expose()
  @Transform(({ obj }) => {
    if (obj.start_time && obj.end_time) {
      // HH:MM:SS에서 HH:MM 형식으로 변환
      const startTime = obj.start_time.substring(0, 5);
      const endTime = obj.end_time.substring(0, 5);
      return `${startTime}-${endTime}`;
    }
    return null;
  })
  time: string;
}