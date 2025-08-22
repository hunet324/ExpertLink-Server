import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { CaseTransformUtil } from '../utils/case-transform.util';
import { LoggerUtil } from '../utils/logger.util';

@Injectable()
export class CaseTransformPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    LoggerUtil.debug('CaseTransformPipe - metadata', { metadata });
    LoggerUtil.debug('CaseTransformPipe - original value', value);
    
    // body 데이터만 변환 (query, param은 제외)
    if (metadata.type === 'body' && value && typeof value === 'object') {
      const transformed = CaseTransformUtil.transformObjectToSnake(value);
      LoggerUtil.debug('CaseTransformPipe - transformed value', transformed);
      return transformed;
    }
    
    LoggerUtil.debug('CaseTransformPipe - no transformation needed');
    return value;
  }
}