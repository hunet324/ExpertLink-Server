import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { NotificationTemplateService } from '../notifications/notification-template.service';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  NotificationTemplateQueryDto,
  NotificationTemplateResponseDto,
  NotificationTemplateListResponseDto,
  PreviewTemplateDto,
  PreviewResponseDto,
  TemplateValidationResponseDto
} from '../notifications/dto/notification-template.dto';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { LoggerUtil } from '../common/utils/logger.util';

@ApiTags('🔔 admin-notifications')
@Controller('admin/system/notifications/templates')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationTemplateAdminController {
  constructor(
    private readonly templateService: NotificationTemplateService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: '알림 템플릿 생성',
    description: '새로운 알림 템플릿을 생성합니다. regional_manager 이상 권한 필요.'
  })
  @ApiResponse({ status: 201, description: '템플릿 생성 성공', type: NotificationTemplateResponseDto })
  @ApiResponse({ status: 409, description: '템플릿 키 중복' })
  @ApiResponse({ status: 400, description: '잘못된 템플릿 형식' })
  async createTemplate(
    @Body() createDto: CreateNotificationTemplateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<NotificationTemplateResponseDto> {
    LoggerUtil.info('관리자 알림 템플릿 생성 요청', { 
      templateKey: createDto.template_key, 
      adminId: req.user.userId 
    });

    return await this.templateService.createTemplate(createDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ 
    summary: '알림 템플릿 목록 조회',
    description: '알림 템플릿 목록을 조회합니다. 검색, 필터링, 페이지네이션 지원.'
  })
  @ApiResponse({ status: 200, description: '목록 조회 성공', type: NotificationTemplateListResponseDto })
  async getTemplates(
    @Query() query: NotificationTemplateQueryDto,
  ): Promise<NotificationTemplateListResponseDto> {
    return await this.templateService.getTemplates(query);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: '알림 템플릿 상세 조회',
    description: '특정 템플릿의 상세 정보를 조회합니다.'
  })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiResponse({ status: 200, description: '상세 조회 성공', type: NotificationTemplateResponseDto })
  @ApiResponse({ status: 404, description: '템플릿을 찾을 수 없음' })
  async getTemplate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotificationTemplateResponseDto> {
    return await this.templateService.getTemplate(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: '알림 템플릿 수정',
    description: '기존 템플릿을 수정합니다. 시스템 템플릿은 활성화/비활성화만 가능.'
  })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiResponse({ status: 200, description: '수정 성공', type: NotificationTemplateResponseDto })
  @ApiResponse({ status: 404, description: '템플릿을 찾을 수 없음' })
  @ApiResponse({ status: 400, description: '시스템 템플릿 수정 제한 또는 형식 오류' })
  async updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateNotificationTemplateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<NotificationTemplateResponseDto> {
    LoggerUtil.info('관리자 알림 템플릿 수정 요청', { 
      templateId: id, 
      adminId: req.user.userId 
    });

    return await this.templateService.updateTemplate(id, updateDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: '알림 템플릿 삭제',
    description: '템플릿을 삭제합니다. 시스템 템플릿은 삭제할 수 없습니다.'
  })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '템플릿을 찾을 수 없음' })
  @ApiResponse({ status: 400, description: '시스템 템플릿 삭제 불가' })
  async deleteTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    LoggerUtil.info('관리자 알림 템플릿 삭제 요청', { 
      templateId: id, 
      adminId: req.user.userId 
    });

    return await this.templateService.deleteTemplate(id, req.user.userId);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '템플릿 미리보기',
    description: '템플릿에 샘플 데이터를 적용하여 미리보기를 생성합니다.'
  })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiResponse({ status: 200, description: '미리보기 생성 성공', type: PreviewResponseDto })
  @ApiResponse({ status: 404, description: '템플릿을 찾을 수 없음' })
  async previewTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() previewDto: PreviewTemplateDto,
  ): Promise<PreviewResponseDto> {
    return await this.templateService.previewTemplate(id, previewDto);
  }

  @Get(':id/validate')
  @ApiOperation({ 
    summary: '템플릿 유효성 검사',
    description: '템플릿의 문법 유효성을 검사하고 사용된 변수들을 분석합니다.'
  })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiResponse({ status: 200, description: '유효성 검사 완료', type: TemplateValidationResponseDto })
  @ApiResponse({ status: 404, description: '템플릿을 찾을 수 없음' })
  async validateTemplate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TemplateValidationResponseDto> {
    return await this.templateService.validateTemplate(id);
  }

  @Put(':id/toggle')
  @ApiOperation({ 
    summary: '템플릿 활성화/비활성화 토글',
    description: '템플릿의 활성화 상태를 전환합니다.'
  })
  @ApiParam({ name: 'id', description: '템플릿 ID' })
  @ApiResponse({ status: 200, description: '상태 변경 성공', type: NotificationTemplateResponseDto })
  @ApiResponse({ status: 404, description: '템플릿을 찾을 수 없음' })
  async toggleTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<NotificationTemplateResponseDto> {
    LoggerUtil.info('관리자 알림 템플릿 상태 토글 요청', { 
      templateId: id, 
      adminId: req.user.userId 
    });

    return await this.templateService.toggleTemplate(id, req.user.userId);
  }
}