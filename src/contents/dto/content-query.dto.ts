import { IsOptional, IsEnum, IsString, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ContentType, ContentCategory } from '../../entities/content.entity';

export class ContentQueryDto {
  @IsOptional()
  @IsEnum(ContentType)
  content_type?: ContentType;

  @IsOptional()
  @IsEnum(ContentCategory)
  category?: ContentCategory;

  @IsOptional()
  @IsString()
  search?: string; // 제목, 요약, 태그에서 검색

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_premium?: boolean;

  @IsOptional()
  @IsString()
  tags?: string; // 쉼표로 구분된 태그 문자열

  @IsOptional()
  @IsString()
  sort_by?: 'latest' | 'popular' | 'views' | 'likes' = 'latest';

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

  // 계산된 속성들
  get offset(): number {
    return (this.page - 1) * this.limit;
  }

  get tagArray(): string[] | undefined {
    return this.tags ? this.tags.split(',').map(tag => tag.trim()) : undefined;
  }
}