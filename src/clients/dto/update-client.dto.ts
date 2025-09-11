import { IsOptional, IsString, IsArray, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RiskAssessmentDto {
  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  suicide_risk?: string;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  self_harm_risk?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'completed'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primary_concerns?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RiskAssessmentDto)
  risk_assessment?: RiskAssessmentDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  treatment_goals?: string[];

  @IsOptional()
  @IsString()
  medical_history?: string;

  @IsOptional()
  @IsString()
  current_medications?: string;

  @IsOptional()
  @IsString()
  previous_therapy?: string;
}