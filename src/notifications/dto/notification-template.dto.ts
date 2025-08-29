import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, IsInt, Min, IsNotEmpty, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateType, TemplateCategory } from '../../entities/notification-template.entity';

export class CreateNotificationTemplateDto {
  @ApiProperty({ description: '템플릿 키 (고유 식별자)', example: 'user_welcome' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  template_key: string;

  @ApiProperty({ description: '템플릿 이름', example: '사용자 환영 메시지' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: '템플릿 설명', example: '신규 사용자 가입 시 발송되는 환영 메시지' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '템플릿 타입', enum: TemplateType, example: TemplateType.IN_APP })
  @IsEnum(TemplateType)
  type: TemplateType;

  @ApiProperty({ description: '템플릿 카테고리', enum: TemplateCategory, example: TemplateCategory.SYSTEM })
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @ApiProperty({ description: '제목 템플릿', example: '{{centerName}}에 오신 것을 환영합니다!' })
  @IsString()
  @IsNotEmpty()
  title_template: string;

  @ApiProperty({ description: '내용 템플릿', example: '안녕하세요 {{userName}}님, 저희 {{centerName}}를 이용해주셔서 감사합니다.' })
  @IsString()
  @IsNotEmpty()
  content_template: string;

  @ApiPropertyOptional({ description: '사용 가능한 변수들', example: { userName: 'string', centerName: 'string' } })
  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ description: '활성화 여부', example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ description: '템플릿 이름', example: '사용자 환영 메시지' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: '템플릿 설명' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '템플릿 타입', enum: TemplateType })
  @IsEnum(TemplateType)
  @IsOptional()
  type?: TemplateType;

  @ApiPropertyOptional({ description: '템플릿 카테고리', enum: TemplateCategory })
  @IsEnum(TemplateCategory)
  @IsOptional()
  category?: TemplateCategory;

  @ApiPropertyOptional({ description: '제목 템플릿' })
  @IsString()
  @IsOptional()
  title_template?: string;

  @ApiPropertyOptional({ description: '내용 템플릿' })
  @IsString()
  @IsOptional()
  content_template?: string;

  @ApiPropertyOptional({ description: '사용 가능한 변수들' })
  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ description: '활성화 여부' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class NotificationTemplateQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', example: 10, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: '검색어 (이름, 설명 검색)', example: '환영' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: '템플릿 타입 필터', enum: TemplateType })
  @IsEnum(TemplateType)
  @IsOptional()
  type?: TemplateType;

  @ApiPropertyOptional({ description: '카테고리 필터', enum: TemplateCategory })
  @IsEnum(TemplateCategory)
  @IsOptional()
  category?: TemplateCategory;

  @ApiPropertyOptional({ description: '활성화 상태 필터', example: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class PreviewTemplateDto {
  @ApiProperty({ description: '미리보기용 샘플 데이터', example: { userName: '김상담자', centerName: '서울심리센터' } })
  @IsObject()
  sample_data: Record<string, any>;
}

export class NotificationTemplateResponseDto {
  @ApiProperty({ description: '템플릿 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '템플릿 키', example: 'user_welcome' })
  template_key: string;

  @ApiProperty({ description: '템플릿 이름', example: '사용자 환영 메시지' })
  name: string;

  @ApiProperty({ description: '템플릿 설명', example: '신규 사용자 가입 시 발송되는 환영 메시지' })
  description: string;

  @ApiProperty({ description: '템플릿 타입', enum: TemplateType })
  type: TemplateType;

  @ApiProperty({ description: '템플릿 카테고리', enum: TemplateCategory })
  category: TemplateCategory;

  @ApiProperty({ description: '제목 템플릿' })
  title_template: string;

  @ApiProperty({ description: '내용 템플릿' })
  content_template: string;

  @ApiProperty({ description: '사용 가능한 변수들' })
  variables: Record<string, any>;

  @ApiProperty({ description: '활성화 여부' })
  is_active: boolean;

  @ApiProperty({ description: '시스템 필수 템플릿 여부' })
  is_system: boolean;

  @ApiProperty({ description: '생성일시' })
  created_at: Date;

  @ApiProperty({ description: '수정일시' })
  updated_at: Date;
}

export class NotificationTemplateListResponseDto {
  @ApiProperty({ description: '템플릿 목록', type: [NotificationTemplateResponseDto] })
  templates: NotificationTemplateResponseDto[];

  @ApiProperty({ description: '페이지네이션 정보' })
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export class PreviewResponseDto {
  @ApiProperty({ description: '렌더링된 제목', example: '서울심리센터에 오신 것을 환영합니다!' })
  title: string;

  @ApiProperty({ description: '렌더링된 내용', example: '안녕하세요 김상담자님, 저희 서울심리센터를 이용해주셔서 감사합니다.' })
  content: string;
}

export class TemplateValidationResponseDto {
  @ApiProperty({ description: '유효성 검사 통과 여부' })
  valid: boolean;

  @ApiProperty({ description: '오류 메시지 목록', type: [String] })
  errors: string[];

  @ApiProperty({ description: '발견된 변수 목록', type: [String] })
  variables: string[];
}