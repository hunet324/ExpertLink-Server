import { Expose, Transform } from 'class-transformer';

export class ClientListResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  phone: string;

  @Expose()
  user_type: string;

  @Expose()
  status: string;

  // age 필드 제거 - 생년월일 데이터가 없어 계산 불가

  @Expose()
  signup_date: Date;

  @Expose()
  total_sessions: number;

  @Expose()
  last_session_date: Date;

  @Expose()
  next_session_date: Date;

  @Expose()
  notes: string;
}

export class ClientDetailResponseDto extends ClientListResponseDto {
  @Expose()
  profile_image: string;

  @Expose()
  bio: string;

  @Expose()
  primary_concerns: string[];

  @Expose()
  medical_history: string;

  @Expose()
  current_medications: string;

  @Expose()
  previous_therapy: string;

  @Expose()
  emergency_contact: {
    name: string;
    relationship: string;
    phone: string;
  };

  @Expose()
  risk_assessment: {
    suicide_risk: string;
    self_harm_risk: string;
    notes: string;
  };

  @Expose()
  treatment_goals: string[];

  @Expose()
  recent_sessions: any[];

  @Expose()
  assessment_results: any[];
}