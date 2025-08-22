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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CentersService } from './centers.service';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { CenterQueryDto } from './dto/center-query.dto';
import { CenterResponseDto, CenterListResponseDto } from './dto/center-response.dto';
import { AssignExpertDto } from './dto/assign-expert.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';

@ApiTags('🏢 admin/centers')
@Controller('admin/centers')
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

  @Get('check-code')
  @ApiOperation({ 
    summary: '🔍 센터 코드 중복 검사', 
    description: '센터 코드의 사용 가능 여부를 확인합니다.' 
  })
  @ApiQuery({ name: 'code', required: true, description: '검사할 센터 코드', example: 'SEL001' })
  @ApiResponse({ 
    status: 200, 
    description: '코드 검사 완료',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean', description: '사용 가능 여부' },
        message: { type: 'string', description: '메시지' }
      }
    }
  })
  @ApiResponse({ status: 400, description: '잘못된 코드 형식' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  async checkCenterCode(@Query('code') code: string): Promise<{ available: boolean; message?: string }> {
    return await this.centersService.checkCenterCode(code);
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

  @Get(':id/staff')
  @ApiOperation({ 
    summary: '👥 센터 직원 목록 조회', 
    description: '특정 센터에 소속된 직원 목록을 조회합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: '센터 직원 목록 조회 성공',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: '김직원' },
          email: { type: 'string', example: 'staff@example.com' },
          userType: { type: 'string', example: 'staff' },
          centerId: { type: 'number', example: 1 },
          supervisorId: { type: 'number', example: 2 },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터를 찾을 수 없습니다.' })
  async getCenterStaff(@Param('id', ParseIntPipe) id: number): Promise<any[]> {
    return await this.centersService.getCenterStaff(id);
  }

  @Get(':id/experts')
  @ApiOperation({ 
    summary: '👨‍⚕️ 센터 전문가 목록 조회', 
    description: '특정 센터에 소속된 전문가 목록을 조회합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: '센터 전문가 목록 조회 성공',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: '김전문가' },
          email: { type: 'string', example: 'expert@example.com' },
          specialties: { type: 'array', items: { type: 'string' }, example: ['우울증', '불안장애'] },
          status: { type: 'string', example: 'active' },
          centerId: { type: 'number', example: 1 },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터를 찾을 수 없습니다.' })
  async getCenterExperts(@Param('id', ParseIntPipe) id: number): Promise<any[]> {
    return await this.centersService.getCenterExperts(id);
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

  @Post(':id/staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '👥 센터 직원 배정', 
    description: '일반 사용자를 해당 센터의 직원으로 배정합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiBody({ 
    type: AssignStaffDto,
    description: '배정할 직원 정보',
    examples: {
      example1: {
        summary: '직원 배정 예시',
        value: { userId: 3 }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: '직원 배정 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '직원이 성공적으로 배정되었습니다.' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: '김직원' },
            email: { type: 'string', example: 'staff@example.com' },
            userType: { type: 'string', example: 'staff' },
            centerId: { type: 'number', example: 1 }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터 또는 사용자를 찾을 수 없습니다.' })
  @ApiResponse({ status: 409, description: '이미 다른 센터에 배정된 사용자' })
  async assignStaffToCenter(
    @Param('id', ParseIntPipe) centerId: number,
    @Body() assignData: AssignStaffDto
  ): Promise<any> {
    const userId = assignData.user_id;
    return await this.centersService.assignStaffToCenter(centerId, userId);
  }

  @Delete(':id/staff/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '👥 센터 직원 배정 해제', 
    description: '센터 직원의 배정을 해제하고 일반 사용자로 변경합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiParam({ name: 'userId', description: '사용자 ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: '직원 배정 해제 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '직원 배정이 해제되었습니다.' }
      }
    }
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터 또는 사용자를 찾을 수 없습니다.' })
  async removeStaffFromCenter(
    @Param('id', ParseIntPipe) centerId: number,
    @Param('userId', ParseIntPipe) userId: number
  ): Promise<any> {
    return await this.centersService.removeStaffFromCenter(centerId, userId);
  }

  @Post(':id/experts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '👨‍⚕️ 센터 전문가 배정', 
    description: '일반 사용자를 해당 센터의 전문가로 배정합니다. ExpertProfile이 없는 경우 자동으로 생성됩니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiBody({ 
    type: AssignExpertDto,
    description: '배정할 전문가 정보',
    examples: {
      example1: {
        summary: '전문가 배정 예시',
        value: { userId: 4 }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: '전문가 배정 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '전문가가 성공적으로 배정되었습니다.' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: '김전문가' },
            email: { type: 'string', example: 'expert@example.com' },
            userType: { type: 'string', example: 'expert' },
            centerId: { type: 'number', example: 1 }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터 또는 사용자를 찾을 수 없습니다.' })
  @ApiResponse({ status: 409, description: '이미 다른 센터에 배정된 사용자' })
  async assignExpertToCenter(
    @Param('id', ParseIntPipe) centerId: number,
    @Body() assignData: AssignExpertDto
  ): Promise<any> {
    const { LoggerUtil } = await import('../common/utils/logger.util');
    
    LoggerUtil.debug('assignExpertToCenter 호출', {
      centerId,
      assignData,
      assignDataType: typeof assignData,
      userId: assignData.userId,
      user_id: assignData.user_id,
      objectKeys: Object.keys(assignData)
    });
    
    const userId = assignData.user_id;
    LoggerUtil.debug('Final userId 결정', { userId });
    
    return await this.centersService.assignExpertToCenter(centerId, userId);
  }

  @Delete(':id/experts/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '👨‍⚕️ 센터 전문가 배정 해제', 
    description: '센터 전문가의 배정을 해제합니다.' 
  })
  @ApiParam({ name: 'id', description: '센터 ID', type: Number })
  @ApiParam({ name: 'userId', description: '사용자 ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: '전문가 배정 해제 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '전문가 배정이 해제되었습니다.' }
      }
    }
  })
  @ApiResponse({ status: 401, description: '인증 토큰이 필요합니다.' })
  @ApiResponse({ status: 403, description: '관리자 권한이 필요합니다.' })
  @ApiResponse({ status: 404, description: '센터 또는 사용자를 찾을 수 없습니다.' })
  async removeExpertFromCenter(
    @Param('id', ParseIntPipe) centerId: number,
    @Param('userId', ParseIntPipe) userId: number
  ): Promise<any> {
    return await this.centersService.removeExpertFromCenter(centerId, userId);
  }
}