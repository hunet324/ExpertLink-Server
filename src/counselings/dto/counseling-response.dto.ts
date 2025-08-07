import { Expose, Transform, Type } from 'class-transformer';
import { CounselingStatus, PaymentStatus } from '../../entities/counseling.entity';

export class CounselingResponseDto {
  @Expose()
  id: number;

  @Expose()
  user_id: number;

  @Expose()
  expert_id: number;

  @Expose()
  schedule_id: number;

  @Expose()
  request_date: Date;

  @Expose()
  appointment_date: Date;

  @Expose()
  status: CounselingStatus;

  @Expose()
  reason: string;

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

  @Expose()
  @Type(() => ScheduleInfoDto)
  schedule: ScheduleInfoDto;
}

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

class ScheduleInfoDto {
  @Expose()
  id: number;

  @Expose()
  schedule_date: Date;

  @Expose()
  start_time: string;

  @Expose()
  end_time: string;

  @Expose()
  title: string;
}