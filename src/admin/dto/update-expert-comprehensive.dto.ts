import { IsOptional, IsString, IsNumber, IsArray, IsEnum, IsPhoneNumber, IsEmail, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from '../../entities/user.entity';

export class UpdateExpertComprehensiveDto {
  // Basic user fields
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  center_id?: number;

  // Expert profile fields
  @IsOptional()
  @IsString()
  license_number?: string;

  @IsOptional()
  @IsString()
  license_type?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(50)
  years_experience?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  hourly_rate?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialization?: string[];

  @IsOptional()
  @IsString()
  introduction?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  career_history?: string;
}

export class UpdateExpertComprehensiveResponseDto {
  message: string;
  expert_id: number;
  expert_name: string;
  updated_fields: {
    user_fields: string[];
    expert_fields: string[];
  };
  updated_at: Date;
}