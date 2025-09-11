import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class ClientSearchDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['all', 'active', 'inactive', 'completed'])
  status?: string;

  @IsOptional()
  @IsEnum(['name', 'registration_date', 'last_session'])
  sort?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}