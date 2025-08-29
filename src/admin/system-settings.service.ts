import { Injectable, NotFoundException, BadRequestException, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting, SettingCategory, SettingValueType } from '../entities/system-setting.entity';
import { SystemLogService } from '../common/services/system-log.service';
import { 
  UpdateSettingDto, 
  BulkUpdateSettingsDto, 
  SettingResponseDto, 
  CategorySettingsResponseDto,
  AllSettingsResponseDto 
} from './dto/system-settings.dto';

@Injectable({ scope: Scope.REQUEST })
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
    private readonly systemLogService: SystemLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  // 카테고리 메타데이터
  private getCategoryMetadata() {
    return {
      general: {
        name: '일반 설정',
        icon: '⚙️',
        description: '플랫폼의 기본적인 운영 설정을 관리합니다'
      },
      user: {
        name: '사용자 설정', 
        icon: '👤',
        description: '사용자 계정 및 인증 관련 설정을 관리합니다'
      },
      payment: {
        name: '결제 설정',
        icon: '💳', 
        description: '결제 시스템 및 수수료 관련 설정을 관리합니다'
      },
      consultation: {
        name: '상담 설정',
        icon: '💬',
        description: '상담 서비스 운영과 관련된 설정을 관리합니다'
      },
      notification: {
        name: '알림 설정',
        icon: '🔔',
        description: '시스템 알림 및 메시지 관련 설정을 관리합니다'
      },
      security: {
        name: '보안 설정',
        icon: '🔒',
        description: '시스템 보안과 관련된 설정을 관리합니다'
      }
    };
  }

  // 모든 설정 조회
  async getAllSettings(): Promise<AllSettingsResponseDto> {
    const settings = await this.systemSettingRepository.find({
      order: { category: 'ASC', id: 'ASC' }
    });

    const categoryMetadata = this.getCategoryMetadata();
    const categoriesMap = new Map<string, SettingResponseDto[]>();

    // 카테고리별로 설정 그룹핑
    for (const setting of settings) {
      const category = setting.category;
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, []);
      }
      categoriesMap.get(category)!.push(this.transformToDto(setting));
    }

    // 카테고리별 응답 구성
    const categories: CategorySettingsResponseDto[] = [];
    for (const [categoryKey, settingList] of categoriesMap) {
      const metadata = categoryMetadata[categoryKey];
      if (metadata) {
        categories.push({
          category: categoryKey as SettingCategory,
          categoryName: metadata.name,
          categoryIcon: metadata.icon,
          categoryDescription: metadata.description,
          settings: settingList
        });
      }
    }

    return { categories };
  }

  // 특정 카테고리 설정 조회
  async getSettingsByCategory(category: SettingCategory): Promise<CategorySettingsResponseDto> {
    const settings = await this.systemSettingRepository.find({
      where: { category },
      order: { id: 'ASC' }
    });

    const categoryMetadata = this.getCategoryMetadata();
    const metadata = categoryMetadata[category];

    if (!metadata) {
      throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${category}`);
    }

    return {
      category,
      categoryName: metadata.name,
      categoryIcon: metadata.icon,
      categoryDescription: metadata.description,
      settings: settings.map(setting => this.transformToDto(setting))
    };
  }

  // 특정 설정 조회
  async getSettingByKey(key: string): Promise<SettingResponseDto> {
    const setting = await this.systemSettingRepository.findOne({ where: { key } });
    
    if (!setting) {
      throw new NotFoundException(`설정을 찾을 수 없습니다: ${key}`);
    }

    return this.transformToDto(setting);
  }

  // 설정 값 업데이트
  async updateSetting(key: string, updateDto: UpdateSettingDto, userId: number): Promise<SettingResponseDto> {
    const setting = await this.systemSettingRepository.findOne({ where: { key } });
    
    if (!setting) {
      throw new NotFoundException(`설정을 찾을 수 없습니다: ${key}`);
    }

    // 값 유효성 검증
    this.validateSettingValue(setting, updateDto.value);

    const oldValue = setting.value;
    setting.value = updateDto.value;
    setting.updated_at = new Date();

    await this.systemSettingRepository.save(setting);

    // 설정 변경 로그 기록
    await this.logSettingChange(userId, key, setting.name, oldValue, updateDto.value);

    return this.transformToDto(setting);
  }

  // 여러 설정 일괄 업데이트
  async bulkUpdateSettings(bulkUpdateDto: BulkUpdateSettingsDto, userId: number): Promise<AllSettingsResponseDto> {
    const keys = Object.keys(bulkUpdateDto.settings);
    const settings = await this.systemSettingRepository.find({
      where: keys.map(key => ({ key }))
    });

    if (settings.length !== keys.length) {
      throw new NotFoundException('일부 설정을 찾을 수 없습니다');
    }

    const updates = [];
    for (const setting of settings) {
      const newValue = bulkUpdateDto.settings[setting.key];
      
      // 값 유효성 검증
      this.validateSettingValue(setting, newValue);

      const oldValue = setting.value;
      setting.value = newValue;
      setting.updated_at = new Date();

      updates.push(this.systemSettingRepository.save(setting));
      
      // 설정 변경 로그 기록
      await this.logSettingChange(userId, setting.key, setting.name, oldValue, newValue);
    }

    await Promise.all(updates);

    return this.getAllSettings();
  }

  // 설정을 기본값으로 리셋
  async resetSetting(key: string, userId: number): Promise<SettingResponseDto> {
    const setting = await this.systemSettingRepository.findOne({ where: { key } });
    
    if (!setting) {
      throw new NotFoundException(`설정을 찾을 수 없습니다: ${key}`);
    }

    const oldValue = setting.value;
    setting.value = setting.default_value;
    setting.updated_at = new Date();

    await this.systemSettingRepository.save(setting);

    // 설정 리셋 로그 기록
    await this.logSettingChange(userId, key, setting.name, oldValue, setting.default_value, 'RESET');

    return this.transformToDto(setting);
  }

  // 설정 값 유효성 검증
  private validateSettingValue(setting: SystemSetting, value: string): void {
    // 필수 값 체크
    if (setting.is_required && (!value || value.trim() === '')) {
      throw new BadRequestException(`${setting.name}은(는) 필수 설정입니다`);
    }

    // 타입별 유효성 검증
    switch (setting.value_type) {
      case SettingValueType.NUMBER:
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new BadRequestException(`${setting.name}은(는) 숫자여야 합니다`);
        }
        
        if (setting.validation_rules) {
          if (setting.validation_rules.min !== undefined && numValue < setting.validation_rules.min) {
            throw new BadRequestException(`${setting.name}은(는) 최소 ${setting.validation_rules.min} 이상이어야 합니다`);
          }
          if (setting.validation_rules.max !== undefined && numValue > setting.validation_rules.max) {
            throw new BadRequestException(`${setting.name}은(는) 최대 ${setting.validation_rules.max} 이하여야 합니다`);
          }
        }
        break;

      case SettingValueType.BOOLEAN:
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException(`${setting.name}은(는) true 또는 false여야 합니다`);
        }
        break;

      case SettingValueType.SELECT:
        if (setting.options && !setting.options.includes(value)) {
          throw new BadRequestException(`${setting.name}의 값이 올바르지 않습니다. 가능한 값: ${setting.options.join(', ')}`);
        }
        break;
    }
  }

  // Entity를 DTO로 변환
  private transformToDto(setting: SystemSetting): SettingResponseDto {
    let transformedValue: string | number | boolean = setting.value;

    // 타입에 따른 값 변환
    if (setting.value_type === SettingValueType.NUMBER) {
      transformedValue = Number(setting.value);
    } else if (setting.value_type === SettingValueType.BOOLEAN) {
      transformedValue = setting.value === 'true';
    }

    let transformedDefaultValue: string | number | boolean = setting.default_value;
    if (setting.value_type === SettingValueType.NUMBER) {
      transformedDefaultValue = Number(setting.default_value);
    } else if (setting.value_type === SettingValueType.BOOLEAN) {
      transformedDefaultValue = setting.default_value === 'true';
    }

    return {
      id: setting.id,
      category: setting.category,
      key: setting.key,
      name: setting.name,
      description: setting.description,
      valueType: setting.value_type,
      value: transformedValue,
      defaultValue: transformedDefaultValue,
      options: setting.options,
      validationRules: setting.validation_rules,
      required: setting.is_required,
      unit: setting.unit,
      createdAt: setting.created_at,
      updatedAt: setting.updated_at
    };
  }

  // 설정 변경 로그 기록
  private async logSettingChange(
    userId: number, 
    key: string, 
    name: string, 
    oldValue: string, 
    newValue: string,
    action: 'UPDATE' | 'RESET' = 'UPDATE'
  ): Promise<void> {
    try {
      const clientIp = this.request.ip || this.request.connection.remoteAddress || 'unknown';
      const userAgent = this.request.get('User-Agent') || 'unknown';
      
      // 사용자 정보는 request에서 가져와야 하므로 임시로 기본값 사용
      await this.systemLogService.logSystemSettingChange(
        userId,
        '관리자', // 실제로는 사용자 이름을 조회해야 함
        'admin', // 실제로는 사용자 타입을 조회해야 함
        key,
        name,
        oldValue,
        newValue,
        action,
        clientIp,
        userAgent
      );
    } catch (error) {
      // 로그 실패는 설정 변경을 방해하지 않음
      console.error('설정 변경 로그 기록 실패:', error);
    }
  }
}