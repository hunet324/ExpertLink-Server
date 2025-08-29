import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CaseTransformUtil } from '../utils/case-transform.util';
import { LoggerUtil } from '../utils/logger.util';

@Injectable()
export class TransformRequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // POST, PUT, PATCH 요청의 body를 camelCase에서 snake_case로 변환
    if (request.body && typeof request.body === 'object') {
      LoggerUtil.debug('TransformRequestInterceptor - 요청 변환', {
        url: request.url,
        method: request.method,
        originalBody: request.body
      });
      
      const originalBody = { ...request.body };
      request.body = CaseTransformUtil.transformObjectToSnake(request.body);
      
      LoggerUtil.debug('TransformRequestInterceptor - 변환 완료', {
        transformedBody: request.body
      });
    }

    // Query parameters는 변환하지 않음 (DTO에서 camelCase로 정의됨)
    // if (request.query && typeof request.query === 'object') {
    //   request.query = CaseTransformUtil.transformObjectToSnake(request.query);
    // }

    return next.handle();
  }
}