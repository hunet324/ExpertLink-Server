import * as fs from 'fs';
import * as path from 'path';

export class LoggerUtil {
  private static logDir = path.join(process.cwd(), 'logs');
  private static isDevelopment = process.env.NODE_ENV !== 'production';
  private static logLevel = process.env.LOG_LEVEL || (this.isDevelopment ? 'DEBUG' : 'INFO');

  static {
    // logs 디렉토리가 없으면 생성
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private static shouldLog(level: 'INFO' | 'ERROR' | 'DEBUG'): boolean {
    const levels = { DEBUG: 0, INFO: 1, ERROR: 2 };
    const currentLevel = levels[this.logLevel as keyof typeof levels] || 1;
    const messageLevel = levels[level];
    return messageLevel >= currentLevel;
  }

  static log(level: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? (this.isDevelopment ? JSON.stringify(data, null, 2) : JSON.stringify(data)) : undefined
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    // 개발 환경에서만 콘솔에 상세 출력
    if (this.isDevelopment) {
      console.log(`[${timestamp}] ${level}: ${message}`);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      // 운영 환경에서는 ERROR만 콘솔 출력
      if (level === 'ERROR') {
        console.error(`[${timestamp}] ${level}: ${message}`);
      }
    }

    // 파일에 저장 (운영 환경에서는 ERROR와 INFO만)
    if (this.isDevelopment || level !== 'DEBUG') {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `app-${today}.log`);
      
      fs.appendFileSync(logFile, logLine);
    }
  }

  static info(message: string, data?: any) {
    this.log('INFO', message, data);
  }

  static error(message: string, data?: any) {
    this.log('ERROR', message, data);
  }

  static debug(message: string, data?: any) {
    this.log('DEBUG', message, data);
  }
}