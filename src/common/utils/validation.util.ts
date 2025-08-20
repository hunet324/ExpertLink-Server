import { BadRequestException } from '@nestjs/common';

export class ValidationUtil {
  /**
   * 이메일 형식 검증
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 전화번호 형식 검증 (한국 형식)
   */
  static validatePhone(phone: string): boolean {
    const phoneRegex = /^01[016789]-?\d{3,4}-?\d{4}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /**
   * 센터 코드 형식 검증
   */
  static validateCenterCode(code: string): boolean {
    // 형식: 대문자 3자리 + 숫자 3자리 (예: SEL001, BUS002)
    const codeRegex = /^[A-Z]{3}\d{3}$/;
    return codeRegex.test(code);
  }

  /**
   * 날짜 범위 검증
   */
  static validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException('시작 날짜는 종료 날짜보다 빨라야 합니다.');
    }

    const now = new Date();
    if (startDate < now && endDate < now) {
      throw new BadRequestException('과거 날짜 범위는 설정할 수 없습니다.');
    }
  }

  /**
   * 휴가 기간 검증
   */
  static validateVacationPeriod(startDate: Date, endDate: Date): void {
    const now = new Date();
    const maxDays = 30; // 최대 30일
    
    if (startDate < now) {
      throw new BadRequestException('휴가 시작일은 현재 날짜 이후여야 합니다.');
    }

    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > maxDays) {
      throw new BadRequestException(`휴가 기간은 최대 ${maxDays}일까지 가능합니다.`);
    }

    if (diffDays < 1) {
      throw new BadRequestException('휴가 기간은 최소 1일 이상이어야 합니다.');
    }
  }

  /**
   * 근무시간 검증
   */
  static validateWorkHours(startTime: string, endTime: string): void {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);

    if (start >= end) {
      throw new BadRequestException('시작 시간은 종료 시간보다 빨라야 합니다.');
    }

    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 12) {
      throw new BadRequestException('하루 근무시간은 12시간을 초과할 수 없습니다.');
    }

    if (diffHours < 1) {
      throw new BadRequestException('근무시간은 최소 1시간 이상이어야 합니다.');
    }
  }

  /**
   * 비밀번호 강도 검증
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    message: string;
    score: number;
  } {
    let score = 0;
    const feedback: string[] = [];

    // 길이 검사
    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('8자 이상');
    }

    // 대문자 포함
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('대문자 포함');
    }

    // 소문자 포함
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('소문자 포함');
    }

    // 숫자 포함
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('숫자 포함');
    }

    // 특수문자 포함
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push('특수문자 포함');
    }

    const isValid = score >= 4;
    const message = isValid 
      ? '강력한 비밀번호입니다.' 
      : `다음 조건을 만족해야 합니다: ${feedback.join(', ')}`;

    return { isValid, message, score };
  }

  /**
   * 파일 크기 검증
   */
  static validateFileSize(fileSize: number, maxSizeMB: number = 5): void {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (fileSize > maxSizeBytes) {
      throw new BadRequestException(`파일 크기는 ${maxSizeMB}MB를 초과할 수 없습니다.`);
    }
  }

  /**
   * 파일 확장자 검증
   */
  static validateFileExtension(filename: string, allowedExtensions: string[]): void {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        `허용되지 않는 파일 형식입니다. 허용 형식: ${allowedExtensions.join(', ')}`
      );
    }
  }

  /**
   * 페이지네이션 파라미터 검증
   */
  static validatePagination(page: number, limit: number): { offset: number; limit: number } {
    if (page < 1) {
      throw new BadRequestException('페이지 번호는 1 이상이어야 합니다.');
    }

    if (limit < 1 || limit > 100) {
      throw new BadRequestException('한 페이지당 항목 수는 1~100 사이여야 합니다.');
    }

    return {
      offset: (page - 1) * limit,
      limit
    };
  }

  /**
   * 사업자등록번호 검증 (한국)
   */
  static validateBusinessNumber(number: string): boolean {
    const cleanNumber = number.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length !== 10) {
      return false;
    }

    const digits = cleanNumber.split('').map(Number);
    const checksum = (digits[0] * 1 + digits[1] * 3 + digits[2] * 7 + 
                     digits[3] * 1 + digits[4] * 3 + digits[5] * 7 + 
                     digits[6] * 1 + digits[7] * 3 + digits[8] * 5) % 10;
    
    const checkDigit = checksum === 0 ? 0 : 10 - checksum;
    
    return checkDigit === digits[9];
  }

  /**
   * 전문가 자격증 번호 검증
   */
  static validateLicenseNumber(licenseNumber: string, licenseType: string): boolean {
    // 라이선스 타입에 따른 번호 형식 검증
    const patterns = {
      '정신건강임상심리사': /^[0-9]{4}-[0-9]{4}$/,
      '임상심리사': /^[0-9]{5}-[0-9]{3}$/,
      '상담심리사': /^[A-Z]{2}[0-9]{6}$/,
      '정신건강상담사': /^[0-9]{6}$/
    };

    const pattern = patterns[licenseType];
    return pattern ? pattern.test(licenseNumber) : true; // 정의되지 않은 타입은 기본 허용
  }
}