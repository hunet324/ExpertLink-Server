import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CentersService } from './centers.service';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { CenterQueryDto } from './dto/center-query.dto';
import { CenterResponseDto, CenterListResponseDto } from './dto/center-response.dto';

@ApiTags('🏢 centers')
@Controller('centers')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class CentersController {
  constructor(private readonly centersService: CentersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: '📍 센터 생성', 
    description: '새로운 상담센터를 생성합니다. 센터 코드는 고유해야 합니다.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: '센터 생성 성공', 
    type: CenterResponseDto 
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 409, description: '중복된 센터 코드' })
  async create(@Body() createDto: CreateCenterDto): Promise<CenterResponseDto> {
    return await this.centersService.create(createDto);
  }

  @Get()
  @ApiOperation({ 
    summary: '📋 센터 목록 조회', 
    description: `센터 목록을 조회합니다.
    
**검색 및 필터링:**
- 센터명, 코드, 주소로 검색 가능
- 상위 센터별 필터링
- 활성 상태별 필터링
- 페이지네이션 지원` 
  })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (센터명, 코드, 주소)' })
  @ApiQuery({ name: 'parentCenterId', required: false, description: '상위 센터 ID 필터' })
  @ApiQuery({ name: 'isActive', required: false, description: '활성 상태 필터' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 개수' })
  @ApiQuery({ name: 'sortBy', required: false, description: '정렬 기준' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '정렬 순서' })
  @ApiResponse({ 
    status: 200, 
    description: '센터 목록 조회 성공', 
    type: CenterListResponseDto 
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  async findAll(@Query() query: CenterQueryDto): Promise<CenterListResponseDto> {
    return await this.centersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: '🏢 센터 상세 조회', 
    description: '특정 센터의 상세 정보를 조회합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: '센터 상세 조회 성공', 
    type: CenterResponseDto 
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터를 찾을 수 없습니다.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CenterResponseDto> {
    return await this.centersService.findOne(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '✏️ 센터 정보 수정', 
    description: '센터 정보를 수정합니다. 센터 코드 변경 시 중복 확인을 합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: '센터 수정 성공', 
    type: CenterResponseDto 
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터를 찾을 수 없습니다.' })
  @ApiResponse({ status: 409, description: '중복된 센터 코드' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCenterDto,
  ): Promise<CenterResponseDto> {
    return await this.centersService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: '🗑️ 센터 삭제', 
    description: `센터를 삭제합니다.
    
**삭제 조건:**
- 하위 센터가 없어야 함
- 소속 직원이 없어야 함
- 소속 전문가가 없어야 함` 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiResponse({ status: 204, description: '센터 삭제 성공' })
  @ApiResponse({ status: 400, description: '삭제 조건을 만족하지 않음' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터를 찾을 수 없습니다.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.centersService.remove(id);
  }

  @Get(':id/stats')
  @ApiOperation({ 
    summary: '📊 센터 통계 조회', 
    description: '특정 센터의 통계 정보를 조회합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: '센터 통계 조회 성공',
    schema: {
      example: {
        centerId: 1,
        centerName: '강남 심리상담센터',
        staffCount: 5,
        expertCount: 10,
        activeCounselings: 25,
        completedCounselingsThisMonth: 120,
        revenue: 15000000,
        averageRating: 4.7
      }
    }
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터를 찾을 수 없습니다.' })
  async getCenterStats(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return await this.centersService.getCenterStatistics(id);
  }
}