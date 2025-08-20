export class DateUtil {
  /**
   * 날짜를 YYYY-MM-DD 형식으로 포맷
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * 시간을 HH:MM 형식으로 포맷
   */
  static formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  /**
   * 날짜 시간을 YYYY-MM-DD HH:MM:SS 형식으로 포맷
   */
  static formatDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }

  /**
   * 두 날짜 사이의 일수 계산
   */
  static getDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 두 시간 사이의 시간 차이 계산 (시간 단위)
   */
  static getHoursBetween(startTime: string, endTime: string): number {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * 현재 날짜가 주말인지 확인
   */
  static isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0: 일요일, 6: 토요일
  }

  /**
   * 현재 날짜가 공휴일인지 확인 (한국 공휴일)
   */
  static isKoreanHoliday(date: Date): boolean {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // 고정 공휴일
    const fixedHolidays = [
      { month: 1, day: 1 },   // 신정
      { month: 3, day: 1 },   // 삼일절
      { month: 5, day: 5 },   // 어린이날
      { month: 6, day: 6 },   // 현충일
      { month: 8, day: 15 },  // 광복절
      { month: 10, day: 3 },  // 개천절
      { month: 10, day: 9 },  // 한글날
      { month: 12, day: 25 }, // 성탄절
    ];

    return fixedHolidays.some(holiday => 
      holiday.month === month && holiday.day === day
    );
  }

  /**
   * 특정 달의 첫째 날과 마지막 날 구하기
   */
  static getMonthRange(year: number, month: number): { start: Date; end: Date } {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start, end };
  }

  /**
   * 특정 주의 첫째 날(월요일)과 마지막 날(일요일) 구하기
   */
  static getWeekRange(date: Date): { start: Date; end: Date } {
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 월요일 시작
    
    const start = new Date(date.setDate(diff));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return { start, end };
  }

  /**
   * 나이 계산
   */
  static calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * 상대적 시간 표시 (몇 분 전, 몇 시간 전 등)
   */
  static getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return '방금 전';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return this.formatDate(date);
    }
  }

  /**
   * 근무일수 계산 (주말과 공휴일 제외)
   */
  static getWorkingDays(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      if (!this.isWeekend(currentDate) && !this.isKoreanHoliday(currentDate)) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  /**
   * 타임존 변환
   */
  static convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: fromTimezone }));
    return new Date(utcDate.toLocaleString('en-US', { timeZone: toTimezone }));
  }

  /**
   * 날짜 유효성 검사
   */
  static isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 문자열을 Date 객체로 안전하게 변환
   */
  static parseDate(dateString: string): Date | null {
    const date = new Date(dateString);
    return this.isValidDate(date) ? date : null;
  }

  /**
   * 한국 시간대로 현재 시간 가져오기
   */
  static getKoreanTime(): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  }
}