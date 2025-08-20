import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CenterResponseDto {
  @ApiProperty({ description: '센터 ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '센터명', example: '강남 심리상담센터' })
  @Expose()
  name: string;

  @ApiProperty({ description: '센터 코드', example: 'SEL001' })
  @Expose()
  code: string;

  @ApiProperty({ description: '주소', example: '서울시 강남구 테헤란로 123' })
  @Expose()
  address: string;

  @ApiProperty({ description: '전화번호', example: '02-1234-5678' })
  @Expose()
  phone: string;

  @ApiProperty({ description: '센터장 ID', example: 2, required: false })
  @Expose()
  managerId?: number;

  @ApiProperty({ description: '센터장 이름', example: '김센터장', required: false })
  @Expose()
  managerName?: string;

  @ApiProperty({ description: '상위 센터 ID', example: 1, required: false })
  @Expose()
  parentCenterId?: number;

  @ApiProperty({ description: '상위 센터명', example: '서울 본부', required: false })
  @Expose()
  parentCenterName?: string;

  @ApiProperty({ description: '활성 상태', example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ description: '직원 수', example: 5 })
  @Expose()
  staffCount?: number;

  @ApiProperty({ description: '전문가 수', example: 10 })
  @Expose()
  expertCount?: number;

  @ApiProperty({ description: '생성일시', example: '2024-01-15T09:30:00Z' })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: '수정일시', example: '2024-01-15T09:30:00Z' })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}

export class CenterListResponseDto {
  @ApiProperty({ type: [CenterResponseDto] })
  @Expose()
  @Type(() => CenterResponseDto)
  centers: CenterResponseDto[];

  @ApiProperty({ description: '전체 개수', example: 25 })
  @Expose()
  total: number;

  @ApiProperty({ description: '페이지 번호', example: 1 })
  @Expose()
  page: number;

  @ApiProperty({ description: '페이지당 개수', example: 10 })
  @Expose()
  limit: number;

  @ApiProperty({ description: '전체 페이지 수', example: 3 })
  @Expose()
  totalPages: number;
}