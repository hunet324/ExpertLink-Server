import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  ParseIntPipe, 
  UseGuards, 
  Request,
  HttpStatus,
  HttpCode,
  ForbiddenException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { VacationService } from './vacation.service';
import { CreateVacationDto, UpdateVacationStatusDto, VacationQueryDto, VacationResponseDto, VacationListResponseDto } from './dto/vacation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CenterManagerGuard } from '../auth/guards/admin-level.guard';
import { CaseTransformPipe } from '../common/pipes/case-transform.pipe';
import { LoggerUtil } from '../common/utils/logger.util';

@ApiTags('Expert Vacation Management')
@ApiBearerAuth()
@Controller('experts')
@UseGuards(JwtAuthGuard)
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('vacation/stats/summary')
  @ApiOperation({ summary: '휴가 통계 조회' })
  @ApiQuery({ name: 'expert_id', required: false, description: '전문가 ID (관리자만)' })
  @ApiResponse({ status: 200, description: '휴가 통계 조회 성공' })
  async getVacationStats(
    @Query('expert_id') expertIdParam?: string,
    @Request() req?: any
  ): Promise<any> {
    // expert_id 파라미터 처리
    let expertId: number | undefined = undefined;
    if (expertIdParam) {
      expertId = parseInt(expertIdParam);
      if (isNaN(expertId)) {
        expertId = undefined;
      }
    }

    LoggerUtil.log('INFO', 'Fetching vacation stats', { userId: req?.user?.id, expertId });

    // 일반 전문가는 본인 통계만 조회 가능
    if (!['super_admin', 'center_manager'].includes(req.user.userType)) {
      expertId = req.user.id;
    }

    return await this.vacationService.getVacationStats(expertId);
  }

  @Get('vacation/expert/:expertId')
  @UseGuards(CenterManagerGuard)
  @ApiOperation({ summary: '특정 전문가 휴가 목록 조회 (관리자용)' })
  @ApiParam({ name: 'expertId', description: '전문가 ID' })
  @ApiResponse({ status: 200, description: '전문가 휴가 목록 조회 성공', type: VacationListResponseDto })
  async getVacationsByExpertId(
    @Param('expertId', ParseIntPipe) expertId: number,
    @Query() queryDto: VacationQueryDto,
    @Request() req: any
  ): Promise<VacationListResponseDto> {
    LoggerUtil.log('INFO', 'Fetching vacations for expert', { 
      userId: req.user.id, 
      expertId, 
      queryDto 
    });

    queryDto.expert_id = expertId;
    return await this.vacationService.getVacations(queryDto, req.user);
  }

  @Get('vacation')
  @ApiOperation({ summary: '휴가 목록 조회' })
  @ApiResponse({ status: 200, description: '휴가 목록 조회 성공', type: VacationListResponseDto })
  @ApiQuery({ name: 'expert_id', required: false, description: '전문가 ID' })
  @ApiQuery({ name: 'status', required: false, description: '휴가 상태' })
  @ApiQuery({ name: 'vacation_type', required: false, description: '휴가 유형' })
  @ApiQuery({ name: 'start_date', required: false, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, description: '종료일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수' })
  async getVacations(
    @Query('expert_id') expertId?: string,
    @Query('status') status?: string,
    @Query('vacation_type') vacationType?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any
  ): Promise<VacationListResponseDto> {
    // 수동으로 파라미터 파싱
    const queryDto: any = {};
    
    if (expertId) queryDto.expert_id = parseInt(expertId);
    if (status) queryDto.status = status;
    if (vacationType) queryDto.vacation_type = vacationType;
    if (startDate) queryDto.start_date = startDate;
    if (endDate) queryDto.end_date = endDate;
    
    queryDto.page = page ? parseInt(page) : 1;
    queryDto.limit = limit ? parseInt(limit) : 20;

    LoggerUtil.log('INFO', 'Fetching vacation list', { userId: req.user.id, queryDto });

    // 일반 전문가는 본인 휴가만 조회 가능
    if (!['super_admin', 'center_manager'].includes(req.user.userType)) {
      queryDto.expert_id = req.user.id;
    }

    return await this.vacationService.getVacations(queryDto, req.user);
  }

  @Post('vacation')
  @ApiOperation({ summary: '휴가 신청' })
  @ApiResponse({ status: 201, description: '휴가 신청 성공', type: VacationResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 404, description: '전문가를 찾을 수 없음' })
  @HttpCode(HttpStatus.CREATED)
  async createVacation(
    @Body(CaseTransformPipe) createVacationDto: CreateVacationDto,
    @Request() req: any
  ): Promise<VacationResponseDto> {
    // expert_id가 없으면 현재 사용자 ID로 자동 설정
    if (!createVacationDto.expert_id) {
      createVacationDto.expert_id = req.user.id;
    }

    LoggerUtil.log('INFO', 'Creating vacation request', { 
      userId: req.user.id, 
      expertId: createVacationDto.expert_id 
    });

    return await this.vacationService.createVacation(createVacationDto, req.user.id);
  }

  @Get('vacation/:id')
  @ApiOperation({ summary: '휴가 상세 조회' })
  @ApiParam({ name: 'id', description: '휴가 ID' })
  @ApiResponse({ status: 200, description: '휴가 상세 조회 성공', type: VacationResponseDto })
  @ApiResponse({ status: 404, description: '휴가를 찾을 수 없음' })
  async getVacationById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ): Promise<VacationResponseDto> {
    LoggerUtil.log('INFO', 'Fetching vacation by ID', { userId: req.user.id, vacationId: id });

    const vacation = await this.vacationService.getVacationById(id, req.user);

    // 일반 전문가는 본인 휴가만 조회 가능
    if (!['super_admin', 'center_manager'].includes(req.user.userType) && 
        vacation.expert_id !== req.user.id) {
      LoggerUtil.log('ERROR', 'Unauthorized vacation access attempt', { 
        userId: req.user.id, 
        vacationId: id,
        expertId: vacation.expert_id 
      });
      throw new ForbiddenException('해당 휴가를 조회할 권한이 없습니다.');
    }

    return vacation;
  }

  @Put('vacation/:id/status')
  @UseGuards(CenterManagerGuard)
  @ApiOperation({ summary: '휴가 승인/거부' })
  @ApiParam({ name: 'id', description: '휴가 ID' })
  @ApiResponse({ status: 200, description: '휴가 상태 변경 성공', type: VacationResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '휴가를 찾을 수 없음' })
  async updateVacationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(CaseTransformPipe) updateStatusDto: UpdateVacationStatusDto,
    @Request() req: any
  ): Promise<VacationResponseDto> {
    LoggerUtil.log('INFO', 'Updating vacation status', { 
      userId: req.user.id, 
      vacationId: id, 
      newStatus: updateStatusDto.status 
    });

    return await this.vacationService.updateVacationStatus(id, updateStatusDto, req.user.id, req.user);
  }

  @Delete('vacation/:id')
  @ApiOperation({ summary: '휴가 삭제' })
  @ApiParam({ name: 'id', description: '휴가 ID' })
  @ApiResponse({ status: 204, description: '휴가 삭제 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '휴가를 찾을 수 없음' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVacation(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ): Promise<void> {
    LoggerUtil.log('INFO', 'Deleting vacation', { userId: req.user.id, vacationId: id });

    await this.vacationService.deleteVacation(id, req.user.id);
  }
}