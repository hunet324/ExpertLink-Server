import { Expose, Transform, Type } from 'class-transformer';
import { UserType, UserStatus } from '../../entities/user.entity';

class UserDetailDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  profile_image: string;

  @Expose()
  bio: string;

  @Expose()
  user_type: UserType;

  @Expose()
  status: UserStatus;
}

export class ExpertListResponseDto {
  @Expose()
  id: number;

  @Expose()
  @Transform(({ obj }) => obj.user?.name)
  name: string;

  @Expose()
  @Transform(({ obj }) => obj.user?.profile_image)
  profile_image: string;

  @Expose()
  specialization: string[];

  @Expose()
  years_experience: number;

  @Expose()
  hourly_rate: number;

  @Expose()
  introduction: string;

  @Expose()
  is_verified: boolean;

  @Expose()
  @Transform(({ obj }) => obj.created_at)
  joined_date: Date;
}

export class ExpertDetailResponseDto {
  @Expose()
  id: number;

  @Expose()
  @Type(() => UserDetailDto)
  user: UserDetailDto;

  @Expose()
  specialization: string[];

  @Expose()
  license_number: string;

  @Expose()
  license_type: string;

  @Expose()
  years_experience: number;

  @Expose()
  hourly_rate: number;

  @Expose()
  introduction: string;

  @Expose()
  education: string;

  @Expose()
  career_history: string;

  @Expose()
  is_verified: boolean;

  @Expose()
  verification_date: Date;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;
}