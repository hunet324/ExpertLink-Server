import { IsOptional, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CenterQueryDto {
  @ApiProperty({ description: '센터명 검색', required: false, example: '강남' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: '상위 센터 ID 필터', required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  parentCenterId?: number;

  @ApiProperty({ description: '활성 상태 필터', required: false, example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: '페이지 번호', required: false, example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '페이지당 개수', required: false, example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ description: '정렬 기준', required: false, example: 'name', default: 'created_at' })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'code' | 'created_at' = 'created_at';

  @ApiProperty({ description: '정렬 순서', required: false, example: 'ASC', default: 'DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}