import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LogLevel, LogCategory } from '../../entities/system-log.entity';

export class SystemLogQueryDto {
  @ApiPropertyOptional({ description: '검색 키워드 (액션, 상세내용, 사용자명, IP주소)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LogLevel, description: '로그 레벨 필터' })
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @ApiPropertyOptional({ enum: LogCategory, description: '카테고리 필터' })
  @IsOptional()
  @IsEnum(LogCategory)
  category?: LogCategory;

  @ApiPropertyOptional({ description: '사용자 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ description: '시작 날짜 (YYYY-MM-DD)', name: 'start_date' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: '종료 날짜 (YYYY-MM-DD)', name: 'end_date' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지당 항목 수', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SystemLogResponseDto {
  @ApiProperty({ description: '로그 ID' })
  id: number;

  @ApiProperty({ description: '로그 발생 시간' })
  timestamp: string;

  @ApiProperty({ enum: LogLevel, description: '로그 레벨' })
  level: LogLevel;

  @ApiProperty({ enum: LogCategory, description: '카테고리' })
  category: LogCategory;

  @ApiProperty({ description: '액션' })
  action: string;

  @ApiPropertyOptional({ description: '사용자 ID' })
  userId?: number;

  @ApiPropertyOptional({ description: '사용자 타입' })
  userType?: string;

  @ApiPropertyOptional({ description: '사용자명' })
  userName?: string;

  @ApiProperty({ description: 'IP 주소' })
  ipAddress: string;

  @ApiPropertyOptional({ description: 'User Agent' })
  userAgent?: string;

  @ApiProperty({ description: '상세 내용' })
  details: string;

  @ApiPropertyOptional({ description: '요청 ID' })
  requestId?: string;

  @ApiPropertyOptional({ description: '응답 시간(ms)' })
  responseTime?: number;

  @ApiPropertyOptional({ description: 'HTTP 상태 코드' })
  statusCode?: number;

  @ApiPropertyOptional({ description: '에러 메시지' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: '스택 트레이스' })
  stackTrace?: string;

  @ApiProperty({ description: '생성 시간' })
  createdAt: string;
}

export class SystemLogListResponseDto {
  @ApiProperty({ type: [SystemLogResponseDto], description: '로그 목록' })
  data: SystemLogResponseDto[];

  @ApiProperty({ description: '페이지네이션 정보' })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class SystemLogStatsDto {
  @ApiProperty({ description: '전체 로그 수' })
  total: number;

  @ApiProperty({ description: '오늘 로그 수' })
  today: number;

  @ApiProperty({ description: '에러 로그 수' })
  errors: number;

  @ApiProperty({ description: '경고 로그 수' })
  warnings: number;

  @ApiProperty({ description: '레벨별 통계' })
  levelStats: {
    debug: number;
    info: number;
    warn: number;
    error: number;
  };

  @ApiProperty({ description: '카테고리별 통계' })
  categoryStats: {
    [key: string]: number;
  };
}

export class CleanupLogsDto {
  @ApiProperty({ description: '삭제할 로그의 일수 (기본: 30일)', default: 30, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  days: number = 30;
}

export class CreateSystemLogDto {
  @ApiProperty({ enum: LogLevel, description: '로그 레벨' })
  @IsEnum(LogLevel)
  level: LogLevel;

  @ApiProperty({ enum: LogCategory, description: '카테고리' })
  @IsEnum(LogCategory)
  category: LogCategory;

  @ApiProperty({ description: '액션' })
  @IsString()
  action: string;

  @ApiPropertyOptional({ description: '사용자 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ description: '사용자 타입' })
  @IsOptional()
  @IsString()
  userType?: string;

  @ApiPropertyOptional({ description: '사용자명' })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiProperty({ description: 'IP 주소' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'User Agent' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: '상세 내용' })
  @IsString()
  details: string;

  @ApiPropertyOptional({ description: '요청 ID' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: '응답 시간(ms)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  responseTime?: number;

  @ApiPropertyOptional({ description: 'HTTP 상태 코드' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  statusCode?: number;

  @ApiPropertyOptional({ description: '에러 메시지' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: '스택 트레이스' })
  @IsOptional()
  @IsString()
  stackTrace?: string;
}