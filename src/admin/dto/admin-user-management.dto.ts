import { Expose, Type } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsNumber, Min, Max, IsEmail, Length, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserType, UserStatus } from '../../entities/user.entity';

export class AdminUserQueryDto {
  @IsOptional()
  @IsEnum(UserType)
  user_type?: UserType;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  search?: string; // 이름, 이메일 검색

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  center_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  centerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sort_by?: 'created_at' | 'name' | 'email' | 'last_login' = 'created_at';

  @IsOptional()
  @IsString()
  sortBy?: 'created_at' | 'name' | 'email' | 'last_login';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}

export class AdminUserDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  user_type: UserType;

  @Expose()
  status: UserStatus;

  @Expose()
  phone?: string;

  @Expose()
  profile_image?: string;

  @Expose()
  @Type(() => Date)
  signup_date: Date;

  @Expose()
  @Type(() => Date)
  created_at: Date;

  @Expose()
  @Type(() => Date)
  updated_at: Date;

  // 추가 통계 정보
  @Expose()
  counseling_count?: number;

  @Expose()
  content_count?: number;

  @Expose()
  psych_test_count?: number;

  @Expose()
  @Type(() => Date)
  last_login_at?: Date;

  @Expose()
  is_verified?: boolean; // 전문가의 경우

  // 인증 상태
  @Expose()
  email_verified?: boolean;

  @Expose()
  phone_verified?: boolean;

  // 활동 통계
  @Expose()
  login_count?: number;

  @Expose()
  total_sessions?: number;

  @Expose()
  total_payments?: number;
}

export class AdminUserListResponseDto {
  @Expose()
  @Type(() => AdminUserDto)
  users: AdminUserDto[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  total_pages: number;
}

export class UserStatusUpdateDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsOptional()
  @IsString()
  reason?: string; // 상태 변경 사유
}

export class UserStatusUpdateResponseDto {
  @Expose()
  message: string;

  @Expose()
  user_id: number;

  @Expose()
  old_status: UserStatus;

  @Expose()
  new_status: UserStatus;

  @Expose()
  updated_at: Date;
}

export class UserUpdateDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserType)
  user_type?: UserType;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  center_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supervisor_id?: number;

  @IsOptional()
  @IsString()
  bio?: string; // 전문가 소개

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[]; // 전문가 전문분야

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  years_experience?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hourly_rate?: number;

  @IsOptional()
  @IsString()
  license_type?: string;

  @IsOptional()
  @IsString()
  license_number?: string;

  @IsOptional()
  @IsString()
  notes?: string; // 관리자 노트
}

export class UserUpdateResponseDto {
  @Expose()
  message: string;

  @Expose()
  user_id: number;

  @Expose()
  @Type(() => AdminUserDto)
  updated_user: AdminUserDto;

  @Expose()
  updated_at: Date;
}