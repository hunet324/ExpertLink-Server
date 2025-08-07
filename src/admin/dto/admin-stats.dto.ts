import { Expose, Type } from 'class-transformer';

export class UserStatsDto {
  @Expose()
  total_users: number;

  @Expose()
  active_users: number;

  @Expose()
  pending_users: number;

  @Expose()
  inactive_users: number;

  @Expose()
  new_users_today: number;

  @Expose()
  new_users_this_week: number;

  @Expose()
  new_users_this_month: number;
}

export class ExpertStatsDto {
  @Expose()
  total_experts: number;

  @Expose()
  verified_experts: number;

  @Expose()
  pending_verification: number;

  @Expose()
  active_experts: number;

  @Expose()
  average_rating: number;
}

export class CounselingStatsDto {
  @Expose()
  total_counselings: number;

  @Expose()
  completed_counselings: number;

  @Expose()
  pending_counselings: number;

  @Expose()
  cancelled_counselings: number;

  @Expose()
  counselings_today: number;

  @Expose()
  counselings_this_week: number;

  @Expose()
  counselings_this_month: number;

  @Expose()
  average_session_duration: number; // 분 단위
}

export class ContentStatsDto {
  @Expose()
  total_contents: number;

  @Expose()
  published_contents: number;

  @Expose()
  draft_contents: number;

  @Expose()
  total_views: number;

  @Expose()
  total_likes: number;

  @Expose()
  most_viewed_content: {
    id: number;
    title: string;
    views: number;
  };
}

export class PsychTestStatsDto {
  @Expose()
  total_tests: number;

  @Expose()
  active_tests: number;

  @Expose()
  total_responses: number;

  @Expose()
  responses_today: number;

  @Expose()
  responses_this_week: number;

  @Expose()
  responses_this_month: number;

  @Expose()
  most_popular_test: {
    id: number;
    title: string;
    response_count: number;
  };
}

export class SystemStatsDto {
  @Expose()
  total_notifications: number;

  @Expose()
  unread_notifications: number;

  @Expose()
  chat_messages_today: number;

  @Expose()
  login_sessions_today: number;

  @Expose()
  server_uptime: string;

  @Expose()
  database_size: string;
}

export class AdminDashboardStatsDto {
  @Expose()
  @Type(() => UserStatsDto)
  users: UserStatsDto;

  @Expose()
  @Type(() => ExpertStatsDto)
  experts: ExpertStatsDto;

  @Expose()
  @Type(() => CounselingStatsDto)
  counselings: CounselingStatsDto;

  @Expose()
  @Type(() => ContentStatsDto)
  contents: ContentStatsDto;

  @Expose()
  @Type(() => PsychTestStatsDto)
  psych_tests: PsychTestStatsDto;

  @Expose()
  @Type(() => SystemStatsDto)
  system: SystemStatsDto;

  @Expose()
  generated_at: Date;
}