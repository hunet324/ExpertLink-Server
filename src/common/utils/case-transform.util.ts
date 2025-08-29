export class CaseTransformUtil {
  /**
   * camelCase를 snake_case로 변환
   */
  static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * snake_case를 camelCase로 변환
   */
  static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * 객체의 모든 키를 camelCase에서 snake_case로 변환
   */
  static transformObjectToSnake(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.transformObjectToSnake(item));
    }
    if (typeof obj !== 'object') return obj;
    // Date 객체는 그대로 반환 (변환하지 않음)
    if (obj instanceof Date) return obj;

    const transformed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = this.camelToSnake(key);
      transformed[snakeKey] = this.transformObjectToSnake(value);
    }
    return transformed;
  }

  /**
   * 객체의 모든 키를 snake_case에서 camelCase로 변환
   */
  static transformObjectToCamel(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.transformObjectToCamel(item));
    }
    if (typeof obj !== 'object') return obj;
    // Date 객체는 그대로 반환 (변환하지 않음)
    if (obj instanceof Date) return obj;

    const transformed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = this.snakeToCamel(key);
      transformed[camelKey] = this.transformObjectToCamel(value);
    }
    return transformed;
  }
}