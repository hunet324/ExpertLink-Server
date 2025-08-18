import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { CaseTransformUtil } from '../utils/case-transform.util';

@Injectable()
export class CaseTransformPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    console.log('🔍 CaseTransformPipe - metadata:', metadata);
    console.log('🔍 CaseTransformPipe - original value:', JSON.stringify(value));
    
    // body 데이터만 변환 (query, param은 제외)
    if (metadata.type === 'body' && value && typeof value === 'object') {
      const transformed = CaseTransformUtil.transformObjectToSnake(value);
      console.log('✅ CaseTransformPipe - transformed value:', JSON.stringify(transformed));
      return transformed;
    }
    
    console.log('⏭️ CaseTransformPipe - no transformation needed');
    return value;
  }
}