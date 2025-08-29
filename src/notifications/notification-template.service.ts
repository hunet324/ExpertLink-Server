import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { 
  CreateNotificationTemplateDto, 
  UpdateNotificationTemplateDto, 
  NotificationTemplateQueryDto,
  NotificationTemplateResponseDto,
  NotificationTemplateListResponseDto,
  PreviewTemplateDto,
  PreviewResponseDto,
  TemplateValidationResponseDto
} from './dto/notification-template.dto';
import { TemplateUtil } from '../common/utils/template.util';
import { LoggerUtil } from '../common/utils/logger.util';

@Injectable()
export class NotificationTemplateService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
  ) {}

  /**
   * 템플릿 생성
   */
  async createTemplate(createDto: CreateNotificationTemplateDto, userId: number): Promise<NotificationTemplateResponseDto> {
    try {
      LoggerUtil.info('알림 템플릿 생성 시작', { templateKey: createDto.template_key, userId });

      // 중복 키 확인
      const existingTemplate = await this.templateRepository.findOne({
        where: { template_key: createDto.template_key }
      });

      if (existingTemplate) {
        throw new ConflictException(`템플릿 키 '${createDto.template_key}'가 이미 존재합니다`);
      }

      // 템플릿 유효성 검사
      const titleValidation = TemplateUtil.validate(createDto.title_template);
      const contentValidation = TemplateUtil.validate(createDto.content_template);

      if (!titleValidation.valid || !contentValidation.valid) {
        const errors = [...titleValidation.errors, ...contentValidation.errors];
        throw new BadRequestException(`템플릿 형식이 올바르지 않습니다: ${errors.join(', ')}`);
      }

      // 변수 정보 자동 추출
      const titleVariables = TemplateUtil.extractVariables(createDto.title_template);
      const contentVariables = TemplateUtil.extractVariables(createDto.content_template);
      const allVariables = [...new Set([...titleVariables, ...contentVariables])];

      // 변수 메타데이터 생성
      const variableMetadata: Record<string, any> = {};
      for (const variable of allVariables) {
        variableMetadata[variable] = {
          type: 'string',
          description: `{{${variable}}} 변수`,
          required: true
        };
      }

      const template = this.templateRepository.create({
        ...createDto,
        variables: {
          ...createDto.variables,
          _auto_detected: variableMetadata
        },
        created_by: userId,
        updated_by: userId
      });

      const savedTemplate = await this.templateRepository.save(template);
      LoggerUtil.info('알림 템플릿 생성 완료', { templateId: savedTemplate.id });

      return this.mapToResponseDto(savedTemplate);
    } catch (error) {
      LoggerUtil.error('알림 템플릿 생성 실패', error);
      throw error;
    }
  }

  /**
   * 템플릿 목록 조회
   */
  async getTemplates(query: NotificationTemplateQueryDto): Promise<NotificationTemplateListResponseDto> {
    try {
      const { page = 1, limit = 10, search, type, category, is_active } = query;
      const skip = (page - 1) * limit;

      const queryBuilder = this.templateRepository.createQueryBuilder('template')
        .leftJoinAndSelect('template.creator', 'creator')
        .leftJoinAndSelect('template.updater', 'updater');

      // 검색 조건
      if (search) {
        queryBuilder.andWhere(
          '(template.name ILIKE :search OR template.description ILIKE :search OR template.template_key ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (type) {
        queryBuilder.andWhere('template.type = :type', { type });
      }

      if (category) {
        queryBuilder.andWhere('template.category = :category', { category });
      }

      if (is_active !== undefined) {
        queryBuilder.andWhere('template.is_active = :is_active', { is_active });
      }

      // 정렬
      queryBuilder.orderBy('template.created_at', 'DESC');

      // 페이지네이션
      const [templates, totalItems] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(totalItems / limit);

      return {
        templates: templates.map(template => this.mapToResponseDto(template)),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      LoggerUtil.error('템플릿 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 템플릿 상세 조회
   */
  async getTemplate(id: number): Promise<NotificationTemplateResponseDto> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['creator', 'updater']
    });

    if (!template) {
      throw new NotFoundException(`ID ${id}에 해당하는 템플릿을 찾을 수 없습니다`);
    }

    return this.mapToResponseDto(template);
  }

  /**
   * 템플릿 수정
   */
  async updateTemplate(id: number, updateDto: UpdateNotificationTemplateDto, userId: number): Promise<NotificationTemplateResponseDto> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } });

      if (!template) {
        throw new NotFoundException(`ID ${id}에 해당하는 템플릿을 찾을 수 없습니다`);
      }

      // 시스템 템플릿은 비활성화만 가능
      if (template.is_system && Object.keys(updateDto).some(key => key !== 'is_active')) {
        throw new BadRequestException('시스템 템플릿은 활성화/비활성화만 변경할 수 있습니다');
      }

      // 템플릿 유효성 검사
      if (updateDto.title_template) {
        const validation = TemplateUtil.validate(updateDto.title_template);
        if (!validation.valid) {
          throw new BadRequestException(`제목 템플릿 형식 오류: ${validation.errors.join(', ')}`);
        }
      }

      if (updateDto.content_template) {
        const validation = TemplateUtil.validate(updateDto.content_template);
        if (!validation.valid) {
          throw new BadRequestException(`내용 템플릿 형식 오류: ${validation.errors.join(', ')}`);
        }
      }

      // 변수 정보 업데이트
      let variableMetadata = template.variables || {};
      if (updateDto.title_template || updateDto.content_template) {
        const titleVariables = TemplateUtil.extractVariables(updateDto.title_template || template.title_template);
        const contentVariables = TemplateUtil.extractVariables(updateDto.content_template || template.content_template);
        const allVariables = [...new Set([...titleVariables, ...contentVariables])];

        const autoDetected: Record<string, any> = {};
        for (const variable of allVariables) {
          autoDetected[variable] = {
            type: 'string',
            description: `{{${variable}}} 변수`,
            required: true
          };
        }

        variableMetadata = {
          ...variableMetadata,
          _auto_detected: autoDetected
        };
      }

      // 템플릿 업데이트
      await this.templateRepository.update(id, {
        ...updateDto,
        ...(variableMetadata && { variables: variableMetadata }),
        updated_by: userId
      });

      const updatedTemplate = await this.templateRepository.findOne({
        where: { id },
        relations: ['creator', 'updater']
      });

      LoggerUtil.info('알림 템플릿 수정 완료', { templateId: id, userId });
      return this.mapToResponseDto(updatedTemplate!);
    } catch (error) {
      LoggerUtil.error('알림 템플릿 수정 실패', error);
      throw error;
    }
  }

  /**
   * 템플릿 삭제
   */
  async deleteTemplate(id: number, userId: number): Promise<{ success: boolean; message: string }> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } });

      if (!template) {
        throw new NotFoundException(`ID ${id}에 해당하는 템플릿을 찾을 수 없습니다`);
      }

      if (template.is_system) {
        throw new BadRequestException('시스템 필수 템플릿은 삭제할 수 없습니다');
      }

      await this.templateRepository.delete(id);
      LoggerUtil.info('알림 템플릿 삭제 완료', { templateId: id, userId });

      return {
        success: true,
        message: '템플릿이 성공적으로 삭제되었습니다'
      };
    } catch (error) {
      LoggerUtil.error('알림 템플릿 삭제 실패', error);
      throw error;
    }
  }

  /**
   * 템플릿 미리보기
   */
  async previewTemplate(id: number, previewDto: PreviewTemplateDto): Promise<PreviewResponseDto> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } });

      if (!template) {
        throw new NotFoundException(`ID ${id}에 해당하는 템플릿을 찾을 수 없습니다`);
      }

      // 기본 변수와 제공된 샘플 데이터 병합
      const defaultVariables = TemplateUtil.getDefaultVariables();
      const variables = { ...defaultVariables, ...previewDto.sample_data };

      const renderedTitle = TemplateUtil.render(template.title_template, variables);
      const renderedContent = TemplateUtil.render(template.content_template, variables);

      return {
        title: renderedTitle,
        content: renderedContent
      };
    } catch (error) {
      LoggerUtil.error('템플릿 미리보기 실패', error);
      throw error;
    }
  }

  /**
   * 템플릿 유효성 검사
   */
  async validateTemplate(id: number): Promise<TemplateValidationResponseDto> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } });

      if (!template) {
        throw new NotFoundException(`ID ${id}에 해당하는 템플릿을 찾을 수 없습니다`);
      }

      const titleValidation = TemplateUtil.validate(template.title_template);
      const contentValidation = TemplateUtil.validate(template.content_template);

      const allErrors = [...titleValidation.errors, ...contentValidation.errors];
      const allVariables = [...new Set([...titleValidation.variables, ...contentValidation.variables])];

      return {
        valid: allErrors.length === 0,
        errors: allErrors,
        variables: allVariables
      };
    } catch (error) {
      LoggerUtil.error('템플릿 유효성 검사 실패', error);
      throw error;
    }
  }

  /**
   * 템플릿 활성화/비활성화 토글
   */
  async toggleTemplate(id: number, userId: number): Promise<NotificationTemplateResponseDto> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } });

      if (!template) {
        throw new NotFoundException(`ID ${id}에 해당하는 템플릿을 찾을 수 없습니다`);
      }

      await this.templateRepository.update(id, {
        is_active: !template.is_active,
        updated_by: userId
      });

      const updatedTemplate = await this.templateRepository.findOne({
        where: { id },
        relations: ['creator', 'updater']
      });

      LoggerUtil.info('템플릿 상태 토글 완료', { templateId: id, newStatus: !template.is_active });
      return this.mapToResponseDto(updatedTemplate!);
    } catch (error) {
      LoggerUtil.error('템플릿 상태 토글 실패', error);
      throw error;
    }
  }

  /**
   * 템플릿 키로 조회 (알림 발송용)
   */
  async getTemplateByKey(templateKey: string): Promise<NotificationTemplate | null> {
    return await this.templateRepository.findOne({
      where: { 
        template_key: templateKey,
        is_active: true 
      }
    });
  }

  /**
   * Response DTO로 변환
   */
  private mapToResponseDto(template: NotificationTemplate): NotificationTemplateResponseDto {
    return {
      id: template.id,
      template_key: template.template_key,
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      title_template: template.title_template,
      content_template: template.content_template,
      variables: template.variables || {},
      is_active: template.is_active,
      is_system: template.is_system,
      created_at: template.created_at,
      updated_at: template.updated_at
    };
  }
}