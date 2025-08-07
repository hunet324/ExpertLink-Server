import { IsOptional, IsString, IsArray, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ExpertSearchDto {
  @IsOptional()
  @IsString()
  search?: string; // 이름, 소개 등에서 검색

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  specialization?: string[]; // 전문분야 필터

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_experience?: number; // 최소 경력

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_hourly_rate?: number; // 최대 시급

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sort?: 'name' | 'experience' | 'rate' | 'created_at' = 'created_at';

  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC' = 'DESC';
}