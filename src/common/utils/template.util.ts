import { LoggerUtil } from './logger.util';

export class TemplateUtil {
  /**
   * 템플릿에서 변수를 추출합니다
   * @param template 템플릿 문자열
   * @returns 발견된 변수명 배열
   */
  static extractVariables(template: string): string[] {
    if (!template) return [];
    
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      const variable = match[1];
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }
    
    return variables;
  }

  /**
   * 템플릿 변수를 실제 값으로 치환합니다
   * @param template 템플릿 문자열
   * @param variables 변수 값들
   * @returns 렌더링된 문자열
   */
  static render(template: string, variables: Record<string, any>): string {
    if (!template) return '';
    
    try {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = variables[key];
        
        // 값이 존재하지 않으면 원본 유지
        if (value === undefined || value === null) {
          LoggerUtil.debug(`템플릿 변수 '${key}' 값이 제공되지 않음, 원본 유지`);
          return match;
        }
        
        // 객체나 배열인 경우 JSON 문자열로 변환
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        
        return String(value);
      });
    } catch (error) {
      LoggerUtil.error('템플릿 렌더링 실패', error);
      return template; // 실패 시 원본 반환
    }
  }

  /**
   * 템플릿 문법 유효성을 검사합니다
   * @param template 템플릿 문자열
   * @returns 검증 결과
   */
  static validate(template: string): { valid: boolean; errors: string[]; variables: string[] } {
    const errors: string[] = [];
    const variables: string[] = [];
    
    if (!template) {
      errors.push('템플릿이 비어있습니다');
      return { valid: false, errors, variables };
    }
    
    try {
      // 기본적인 중괄호 짝 맞춤 검사
      const openBraces = (template.match(/\{\{/g) || []).length;
      const closeBraces = (template.match(/\}\}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        errors.push('중괄호 짝이 맞지 않습니다');
      }
      
      // 변수명 형식 검사
      const regex = /\{\{(\w*)\}\}/g;
      let match;
      
      while ((match = regex.exec(template)) !== null) {
        const variable = match[1];
        
        if (!variable) {
          errors.push('빈 변수명이 발견되었습니다: {{}}');
          continue;
        }
        
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) {
          errors.push(`잘못된 변수명 형식: ${variable}`);
          continue;
        }
        
        if (!variables.includes(variable)) {
          variables.push(variable);
        }
      }
      
      // 잘못된 중괄호 패턴 검사
      const invalidPatterns = [
        /\{[^{]/, // 단일 여는 중괄호
        /[^}]\}/, // 단일 닫는 중괄호
        /\{\{\{/, // 3개 이상의 여는 중괄호
        /\}\}\}/, // 3개 이상의 닫는 중괄호
      ];
      
      for (const pattern of invalidPatterns) {
        if (pattern.test(template)) {
          errors.push('잘못된 중괄호 패턴이 발견되었습니다');
          break;
        }
      }
      
    } catch (error) {
      LoggerUtil.error('템플릿 검증 중 오류 발생', error);
      errors.push('템플릿 검증 중 오류가 발생했습니다');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      variables
    };
  }

  /**
   * 기본 변수들을 제공합니다 (시스템 공통 변수)
   * @param userId 사용자 ID
   * @returns 기본 변수 객체
   */
  static getDefaultVariables(userId?: number): Record<string, any> {
    return {
      systemName: 'ExpertLink',
      currentDate: new Date().toLocaleDateString('ko-KR'),
      currentTime: new Date().toLocaleTimeString('ko-KR'),
      currentYear: new Date().getFullYear(),
      supportEmail: 'support@expertlink.com',
      supportPhone: '02-1234-5678',
      ...(userId && { userId })
    };
  }

  /**
   * 샘플 데이터를 생성합니다 (미리보기용)
   * @param variables 변수명 배열
   * @returns 샘플 변수 객체
   */
  static generateSampleData(variables: string[]): Record<string, any> {
    const sampleData: Record<string, any> = {};
    
    // 기본 변수들
    const defaultVars = this.getDefaultVariables(1);
    Object.assign(sampleData, defaultVars);
    
    // 자주 사용되는 변수들의 샘플 값
    const commonSamples: Record<string, any> = {
      userName: '김상담자',
      userEmail: 'user@example.com',
      expertName: '이상담사',
      expertEmail: 'expert@example.com',
      centerName: '서울심리센터',
      centerPhone: '02-9876-5432',
      counselingDate: '2024-08-28',
      counselingTime: '14:00',
      appointmentId: 'APT-2024-001',
      sessionDuration: '50분',
      amount: '50,000원',
      testName: 'MMPI-2 성격검사',
      testResult: '정상범위',
      contentTitle: '스트레스 관리법',
      notificationCount: 3,
      meetingLink: 'https://meet.expertlink.com/room123'
    };
    
    // 요청된 변수들에 대한 샘플 값 생성
    for (const variable of variables) {
      if (!sampleData[variable]) {
        sampleData[variable] = commonSamples[variable] || `[${variable} 샘플값]`;
      }
    }
    
    return sampleData;
  }
}