import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggerUtil } from '../utils/logger.util';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);
  private readonly slowQueryThreshold = 3000; // 3초
  private readonly verySlowQueryThreshold = 10000; // 10초

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const userId = (request as any).user?.id;
    const userType = (request as any).user?.user_type;

    // 메모리 사용량 측정
    const initialMemory = process.memoryUsage();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        const statusCode = response.statusCode;
        const finalMemory = process.memoryUsage();
        const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;

        // 기본 로그
        const logData = {
          method,
          url,
          statusCode,
          responseTime: `${responseTime}ms`,
          userId,
          userType,
          ip,
          userAgent: userAgent.substring(0, 100),
          memoryDelta: `${Math.round(memoryDelta / 1024)}KB`,
        };

        // 성능 분류에 따른 로깅
        if (responseTime > this.verySlowQueryThreshold) {
          LoggerUtil.error('매우 느린 API 응답', logData);
        } else if (responseTime > this.slowQueryThreshold) {
          LoggerUtil.warn('느린 API 응답', logData);
        } else {
          LoggerUtil.debug('API 응답', logData);
        }

        // 메트릭 기록
        this.recordMetrics(method, url, statusCode, responseTime);
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = response.statusCode || 500;

        // 오류 로깅
        LoggerUtil.error('API 오류', {
          method,
          url,
          statusCode,
          responseTime: `${responseTime}ms`,
          error: error.message,
          stack: error.stack,
          userId,
          userType,
          ip,
        });

        throw error;
      })
    );
  }

  private recordMetrics(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number
  ): void {
    // 현재는 로컬 메트릭만 기록
    this.updateLocalMetrics(method, url, statusCode, responseTime);
  }

  private updateLocalMetrics(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number
  ): void {
    // 메트릭을 메모리에 저장
    const key = `${method}:${url}`;
    
    // 글로벌 메트릭 객체에 저장
    if (!(global as any).apiMetrics) {
      (global as any).apiMetrics = {};
    }
    
    const metrics = (global as any).apiMetrics;
    if (!metrics[key]) {
      metrics[key] = {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
      };
    }
    
    metrics[key].count++;
    metrics[key].totalTime += responseTime;
    metrics[key].minTime = Math.min(metrics[key].minTime, responseTime);
    metrics[key].maxTime = Math.max(metrics[key].maxTime, responseTime);
    
    if (statusCode >= 400) {
      metrics[key].errors++;
    }
  }

  // 메트릭 조회용 헬퍼 메서드
  static getMetrics(): any {
    return (global as any).apiMetrics || {};
  }

  // 메트릭 요약 정보
  static getMetricsSummary(): any {
    const metrics = this.getMetrics();
    const summary = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      slowestEndpoint: { url: '', time: 0 },
      errorRates: {} as any,
    };

    let totalTime = 0;
    
    Object.entries(metrics).forEach(([key, data]: [string, any]) => {
      summary.totalRequests += data.count;
      summary.totalErrors += data.errors;
      totalTime += data.totalTime;
      
      if (data.maxTime > summary.slowestEndpoint.time) {
        summary.slowestEndpoint = { url: key, time: data.maxTime };
      }
      
      summary.errorRates[key] = {
        rate: data.count > 0 ? (data.errors / data.count * 100).toFixed(2) + '%' : '0%',
        errors: data.errors,
        total: data.count,
      };
    });
    
    summary.averageResponseTime = summary.totalRequests > 0 
      ? Math.round(totalTime / summary.totalRequests) 
      : 0;
    
    return summary;
  }
}