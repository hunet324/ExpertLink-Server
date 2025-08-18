import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CaseTransformUtil } from '../utils/case-transform.util';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // 응답 데이터를 snake_case에서 camelCase로 변환
        return CaseTransformUtil.transformObjectToCamel(data);
      }),
    );
  }
}