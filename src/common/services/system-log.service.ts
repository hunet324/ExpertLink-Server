import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLog, LogLevel, LogCategory } from '../../entities/system-log.entity';
import { LoggerUtil } from '../utils/logger.util';

@Injectable()
export class SystemLogService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly systemLogRepository: Repository<SystemLog>,
  ) {}

  // 사용자 로그인 로그
  async logUserLogin(userId: number, userName: string, userType: string, ipAddress: string, userAgent: string): Promise<void> {
    await this.createSystemLog({
      level: LogLevel.INFO,
      category: LogCategory.AUTH,
      action: 'USER_LOGIN',
      details: `사용자 로그인 성공: ${userName} (${userType})`,
      userId,
      userType,
      userName,
      ipAddress,
      userAgent,
      requestId: null,
      responseTime: null,
      statusCode: null,
      errorMessage: null,
      stackTrace: null,
    });
  }

  // 사용자 로그아웃 로그
  async logUserLogout(userId: number, userName: string, userType: string, ipAddress: string): Promise<void> {
    await this.createSystemLog({
      level: LogLevel.INFO,
      category: LogCategory.AUTH,
      action: 'USER_LOGOUT',
      details: `사용자 로그아웃: ${userName} (${userType})`,
      userId,
      userType,
      userName,
      ipAddress,
      userAgent: 'unknown',
      requestId: null,
      responseTime: null,
      statusCode: null,
      errorMessage: null,
      stackTrace: null,
    });
  }

  // 결제 이벤트 로그
  async logPaymentEvent(action: string, details: string, userId?: number, userName?: string, ipAddress?: string): Promise<void> {
    await this.createSystemLog({
      level: LogLevel.INFO,
      category: LogCategory.PAYMENT,
      action,
      details,
      userId,
      userName,
      userType: null,
      ipAddress: ipAddress || 'unknown',
      userAgent: 'unknown',
      requestId: null,
      responseTime: null,
      statusCode: null,
      errorMessage: null,
      stackTrace: null,
    });
  }

  // 비밀번호 변경 로그
  async logPasswordChange(userId: number, userName: string, userType: string, ipAddress: string, userAgent: string): Promise<void> {
    await this.createSystemLog({
      level: LogLevel.INFO,
      category: LogCategory.AUTH,
      action: 'PASSWORD_CHANGE',
      details: `사용자가 비밀번호를 변경했습니다: ${userName} (${userType})`,
      userId,
      userType,
      userName,
      ipAddress,
      userAgent,
      requestId: null,
      responseTime: null,
      statusCode: 200,
      errorMessage: null,
      stackTrace: null,
    });
  }

  // 시스템 설정 변경 로그
  async logSystemSettingChange(
    userId: number, 
    userName: string, 
    userType: string, 
    settingKey: string, 
    settingName: string, 
    oldValue: string, 
    newValue: string,
    action: 'UPDATE' | 'RESET' = 'UPDATE',
    ipAddress: string, 
    userAgent: string
  ): Promise<void> {
    await this.createSystemLog({
      level: LogLevel.INFO,
      category: LogCategory.ADMIN,
      action: `SYSTEM_SETTING_${action}`,
      details: `시스템 설정 변경: ${settingName}(${settingKey}) "${oldValue}" → "${newValue}"`,
      userId,
      userType,
      userName,
      ipAddress,
      userAgent,
      requestId: null,
      responseTime: null,
      statusCode: 200,
      errorMessage: null,
      stackTrace: null,
    });
  }

  // 시스템 로그 생성 메서드
  private async createSystemLog(logData: {
    level: LogLevel;
    category: LogCategory;
    action: string;
    details: string;
    userId?: number;
    userType?: string;
    userName?: string;
    ipAddress: string;
    userAgent: string;
    requestId?: string;
    responseTime?: number;
    statusCode?: number;
    errorMessage?: string;
    stackTrace?: string;
  }): Promise<void> {
    try {
      const systemLog = this.systemLogRepository.create({
        timestamp: new Date(),
        level: logData.level,
        category: logData.category,
        action: logData.action,
        userId: logData.userId,
        userType: logData.userType,
        userName: logData.userName,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        details: logData.details,
        requestId: logData.requestId,
        responseTime: logData.responseTime,
        statusCode: logData.statusCode,
        errorMessage: logData.errorMessage,
        stackTrace: logData.stackTrace,
      });

      await this.systemLogRepository.save(systemLog);

      // 로컬 파일 로그도 기록
      LoggerUtil.info('System Log Created', {
        action: logData.action,
        userId: logData.userId,
        details: logData.details
      });

    } catch (error) {
      LoggerUtil.error('시스템 로그 생성 실패', error);
      // 로그 생성 실패는 다른 기능에 영향을 주지 않도록 에러를 던지지 않음
    }
  }
}