import { Controller, Get, Put, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { SettingCategory } from '../entities/system-setting.entity';
import {
  UpdateSettingDto,
  BulkUpdateSettingsDto,
  SettingResponseDto,
  CategorySettingsResponseDto,
  AllSettingsResponseDto
} from './dto/system-settings.dto';

@ApiTags('🔧 admin-system-settings')
@Controller('admin/system-settings')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: '모든 시스템 설정 조회', description: '모든 카테고리의 시스템 설정을 조회합니다.' })
  @ApiResponse({ status: 200, description: '설정 조회 성공', type: AllSettingsResponseDto })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  @HttpCode(HttpStatus.OK)
  async getAllSettings(): Promise<AllSettingsResponseDto> {
    return await this.systemSettingsService.getAllSettings();
  }

  @Get('category/:category')
  @ApiOperation({ summary: '카테고리별 설정 조회', description: '특정 카테고리의 설정을 조회합니다.' })
  @ApiParam({ name: 'category', enum: SettingCategory, description: '설정 카테고리' })
  @ApiResponse({ status: 200, description: '카테고리 설정 조회 성공', type: CategorySettingsResponseDto })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  @HttpCode(HttpStatus.OK)
  async getSettingsByCategory(@Param('category') category: SettingCategory): Promise<CategorySettingsResponseDto> {
    return await this.systemSettingsService.getSettingsByCategory(category);
  }

  @Get(':key')
  @ApiOperation({ summary: '특정 설정 조회', description: '특정 키의 설정을 조회합니다.' })
  @ApiParam({ name: 'key', description: '설정 키' })
  @ApiResponse({ status: 200, description: '설정 조회 성공', type: SettingResponseDto })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  @ApiResponse({ status: 404, description: '설정을 찾을 수 없음' })
  @HttpCode(HttpStatus.OK)
  async getSettingByKey(@Param('key') key: string): Promise<SettingResponseDto> {
    return await this.systemSettingsService.getSettingByKey(key);
  }

  @Put(':key')
  @ApiOperation({ summary: '설정 값 업데이트', description: '특정 설정의 값을 업데이트합니다.' })
  @ApiParam({ name: 'key', description: '설정 키' })
  @ApiResponse({ status: 200, description: '설정 업데이트 성공', type: SettingResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 설정 값' })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  @ApiResponse({ status: 404, description: '설정을 찾을 수 없음' })
  @HttpCode(HttpStatus.OK)
  async updateSetting(
    @Param('key') key: string,
    @Body() updateDto: UpdateSettingDto,
    @Req() req: AuthenticatedRequest
  ): Promise<SettingResponseDto> {
    return await this.systemSettingsService.updateSetting(key, updateDto, req.user.userId);
  }

  @Put()
  @ApiOperation({ summary: '여러 설정 일괄 업데이트', description: '여러 설정을 한 번에 업데이트합니다.' })
  @ApiResponse({ status: 200, description: '설정 일괄 업데이트 성공', type: AllSettingsResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 설정 값' })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  @ApiResponse({ status: 404, description: '일부 설정을 찾을 수 없음' })
  @HttpCode(HttpStatus.OK)
  async bulkUpdateSettings(
    @Body() bulkUpdateDto: BulkUpdateSettingsDto,
    @Req() req: AuthenticatedRequest
  ): Promise<AllSettingsResponseDto> {
    return await this.systemSettingsService.bulkUpdateSettings(bulkUpdateDto, req.user.userId);
  }

  @Put(':key/reset')
  @ApiOperation({ summary: '설정 기본값으로 리셋', description: '설정을 기본값으로 되돌립니다.' })
  @ApiParam({ name: 'key', description: '설정 키' })
  @ApiResponse({ status: 200, description: '설정 리셋 성공', type: SettingResponseDto })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  @ApiResponse({ status: 404, description: '설정을 찾을 수 없음' })
  @HttpCode(HttpStatus.OK)
  async resetSetting(
    @Param('key') key: string,
    @Req() req: AuthenticatedRequest
  ): Promise<SettingResponseDto> {
    return await this.systemSettingsService.resetSetting(key, req.user.userId);
  }
}