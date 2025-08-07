import { Exclude, Expose } from 'class-transformer';
import { UserType, UserStatus } from '../../entities/user.entity';

export class ProfileResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  phone: string;

  @Expose()
  user_type: UserType;

  @Expose()
  status: UserStatus;

  @Expose()
  profile_image: string;

  @Expose()
  bio: string;

  @Expose()
  signup_date: Date;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  @Exclude()
  password_hash: string;
}