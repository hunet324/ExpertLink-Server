import { Expose, Transform, Type } from 'class-transformer';
import { UserType, UserStatus } from '../../entities/user.entity';

export class UserDetailDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  phone: string;

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
  @Transform(({ obj }) => {
    console.log('Transform userEmail - obj.user:', obj.user);
    return obj.user?.email || obj.email;
  })
  userEmail: string;

  @Expose()
  @Transform(({ obj }) => {
    console.log('Transform userPhone - obj.user:', obj.user);
    return obj.user?.phone || obj.phone;
  })
  userPhone: string;

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

  @Expose()
  certifications: string[];

  @Expose()
  available_hours: object;

  @Expose()
  consultation_settings: object;

  @Expose()
  pricing_settings: object;
}