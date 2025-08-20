import { IsString, IsOptional, IsNumber, IsBoolean, Length, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCenterDto {
  @ApiProperty({ description: '센터명', example: '강남 심리상담센터' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: '센터 코드', example: 'SEL001' })
  @IsString()
  @Length(1, 20)
  code: string;

  @ApiProperty({ description: '주소', example: '서울시 강남구 테헤란로 123' })
  @IsString()
  address: string;

  @ApiProperty({ description: '전화번호', example: '02-1234-5678' })
  @IsString()
  @Length(1, 20)
  phone: string;

  @ApiProperty({ description: '센터장 ID', example: 2, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  managerId?: number;

  @ApiProperty({ description: '상위 센터 ID', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  parentCenterId?: number;

  @ApiProperty({ description: '활성 상태', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}