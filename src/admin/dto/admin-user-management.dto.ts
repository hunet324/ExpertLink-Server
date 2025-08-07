import { Expose, Type } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserType, UserStatus } from '../../entities/user.entity';

export class AdminUserQueryDto {
  @IsOptional()
  @IsEnum(UserType)
  user_type?: UserType;

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
  sort_order?: 'ASC' | 'DESC' = 'DESC';

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