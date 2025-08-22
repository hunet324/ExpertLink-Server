import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CaseTransformUtil } from '../utils/case-transform.util';

@Injectable()
export class TransformRequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // POST, PUT, PATCH 요청의 body를 camelCase에서 snake_case로 변환
    if (request.body && typeof request.body === 'object') {
      // 로거를 동적으로 import (순환 참조 방지)
      import('../utils/logger.util').then(({ LoggerUtil }) => {
        LoggerUtil.debug('TransformRequestInterceptor - 요청 변환', {
          url: request.url,
          method: request.method,
          originalBody: request.body
        });
      });
      
      const originalBody = { ...request.body };
      request.body = CaseTransformUtil.transformObjectToSnake(request.body);
      
      import('../utils/logger.util').then(({ LoggerUtil }) => {
        LoggerUtil.debug('TransformRequestInterceptor - 변환 완료', {
          transformedBody: request.body
        });
      });
    }

    // Query parameters도 변환
    if (request.query && typeof request.query === 'object') {
      request.query = CaseTransformUtil.transformObjectToSnake(request.query);
    }

    return next.handle();
  }
}