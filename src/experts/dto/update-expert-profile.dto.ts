import { IsOptional, IsString, IsArray, IsNumber, Min, Max, MaxLength } from 'class-validator';

export class UpdateExpertProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialization?: string[];

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
}