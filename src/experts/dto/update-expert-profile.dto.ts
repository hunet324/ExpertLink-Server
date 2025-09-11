import { IsOptional, IsString, IsArray, IsNumber, Min, Max, MaxLength } from 'class-validator';

export class UpdateExpertProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialization?: string[];

  // snake_case (기존)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  license_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  license_type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  years_experience?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourly_rate?: number;

  @IsOptional()
  available_hours?: object;

  @IsOptional()
  consultation_settings?: object;

  @IsOptional()
  pricing_settings?: object;

  // camelCase (프론트엔드 호환)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenseType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  yearsExperience?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  availableHours?: object;

  @IsOptional()
  consultationSettings?: object;

  @IsOptional()
  pricingSettings?: object;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  introduction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  education?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  career_history?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];
}