import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsObject, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { SettingCategory, SettingValueType } from '../../entities/system-setting.entity';

export class UpdateSettingDto {
  @ApiProperty({ description: '설정 값' })
  @IsString()
  value: string;
}

export class BulkUpdateSettingsDto {
  @ApiProperty({ 
    description: '설정 업데이트 목록',
    type: 'object',
    additionalProperties: { type: 'string' }
  })
  @IsObject()
  settings: Record<string, string>;
}

export class SettingResponseDto {
  @ApiProperty({ description: '설정 ID' })
  id: number;

  @ApiProperty({ description: '카테고리', enum: SettingCategory })
  category: SettingCategory;

  @ApiProperty({ description: '설정 키' })
  key: string;

  @ApiProperty({ description: '설정 이름' })
  name: string;

  @ApiPropertyOptional({ description: '설정 설명' })
  description?: string;

  @ApiProperty({ description: '값 타입', enum: SettingValueType })
  valueType: SettingValueType;

  @ApiProperty({ description: '현재 값' })
  value: string | number | boolean;

  @ApiProperty({ description: '기본값' })
  defaultValue: string | number | boolean;

  @ApiPropertyOptional({ description: '옵션 목록 (select 타입)' })
  options?: string[];

  @ApiPropertyOptional({ description: '유효성 검사 규칙' })
  validationRules?: {
    min?: number;
    max?: number;
  };

  @ApiProperty({ description: '필수 여부' })
  required: boolean;

  @ApiPropertyOptional({ description: '단위' })
  unit?: string;

  @ApiProperty({ description: '생성일' })
  createdAt: Date;

  @ApiProperty({ description: '수정일' })
  updatedAt: Date;
}

export class CategorySettingsResponseDto {
  @ApiProperty({ description: '카테고리', enum: SettingCategory })
  category: SettingCategory;

  @ApiProperty({ description: '카테고리 이름' })
  categoryName: string;

  @ApiProperty({ description: '카테고리 아이콘' })
  categoryIcon: string;

  @ApiProperty({ description: '카테고리 설명' })
  categoryDescription: string;

  @ApiProperty({ description: '설정 목록', type: [SettingResponseDto] })
  settings: SettingResponseDto[];
}

export class AllSettingsResponseDto {
  @ApiProperty({ description: '전체 카테고리별 설정', type: [CategorySettingsResponseDto] })
  categories: CategorySettingsResponseDto[];
}