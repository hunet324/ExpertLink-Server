import { UserType } from '../../entities/user.entity';

// 권한 레벨 정의 (숫자가 높을수록 높은 권한)
export const PERMISSION_LEVELS = {
  [UserType.GENERAL]: 0,
  [UserType.EXPERT]: 1,
  [UserType.STAFF]: 2,
  [UserType.CENTER_MANAGER]: 3,
  [UserType.REGIONAL_MANAGER]: 4,
  [UserType.SUPER_ADMIN]: 5,
} as const;

export class PermissionUtil {
  /**
   * 사용자가 필요한 최소 권한을 가지고 있는지 확인
   */
  static hasMinimumRole(userType: UserType, requiredRole: UserType): boolean {
    const userLevel = PERMISSION_LEVELS[userType] || 0;
    const requiredLevel = PERMISSION_LEVELS[requiredRole];
    return userLevel >= requiredLevel;
  }

  /**
   * 사용자가 특정 역할들 중 하나라도 가지고 있는지 확인
   */
  static hasAnyRole(userType: UserType, allowedRoles: UserType[]): boolean {
    return allowedRoles.includes(userType);
  }

  /**
   * 사용자가 관리자인지 확인
   */
  static isAdmin(userType: UserType): boolean {
    return [
      UserType.STAFF,
      UserType.CENTER_MANAGER,
      UserType.REGIONAL_MANAGER,
      UserType.SUPER_ADMIN
    ].includes(userType);
  }

  /**
   * 사용자가 센터 레벨 이상의 관리자인지 확인
   */
  static isCenterManagerOrAbove(userType: UserType): boolean {
    return [
      UserType.CENTER_MANAGER,
      UserType.REGIONAL_MANAGER,
      UserType.SUPER_ADMIN
    ].includes(userType);
  }

  /**
   * 사용자가 지역 관리자 이상인지 확인
   */
  static isRegionalManagerOrAbove(userType: UserType): boolean {
    return [
      UserType.REGIONAL_MANAGER,
      UserType.SUPER_ADMIN
    ].includes(userType);
  }

  /**
   * 사용자가 최고 관리자인지 확인
   */
  static isSuperAdmin(userType: UserType): boolean {
    return userType === UserType.SUPER_ADMIN;
  }

  /**
   * 사용자가 다른 센터의 데이터에 접근할 수 있는지 확인
   */
  static canAccessOtherCenters(userType: UserType): boolean {
    return [
      UserType.SUPER_ADMIN,
      UserType.REGIONAL_MANAGER
    ].includes(userType);
  }

  /**
   * 사용자가 특정 센터의 데이터에 접근할 수 있는지 확인
   */
  static canAccessCenter(userType: UserType, userCenterId: number | null, targetCenterId: number): boolean {
    // 최고 관리자와 지역 관리자는 모든 센터 접근 가능
    if (this.canAccessOtherCenters(userType)) {
      return true;
    }

    // 센터장과 직원은 자신의 센터만 접근 가능
    if (this.isAdmin(userType)) {
      return userCenterId === targetCenterId;
    }

    // 일반 사용자와 전문가는 센터 관리 접근 불가
    return false;
  }

  /**
   * 사용자가 다른 사용자를 관리할 수 있는지 확인
   */
  static canManageUser(managerType: UserType, targetUserType: UserType): boolean {
    const managerLevel = PERMISSION_LEVELS[managerType] || 0;
    const targetLevel = PERMISSION_LEVELS[targetUserType] || 0;

    // 자신보다 낮은 레벨의 사용자만 관리 가능
    return managerLevel > targetLevel;
  }

  /**
   * 권한 레벨을 문자열로 반환
   */
  static getRoleName(userType: UserType): string {
    const roleNames = {
      [UserType.GENERAL]: '일반 사용자',
      [UserType.EXPERT]: '전문가',
      [UserType.STAFF]: '직원',
      [UserType.CENTER_MANAGER]: '센터장',
      [UserType.REGIONAL_MANAGER]: '지역 관리자',
      [UserType.SUPER_ADMIN]: '최고 관리자',
    };

    return roleNames[userType] || '알 수 없음';
  }

  /**
   * 권한 레벨 숫자 반환
   */
  static getPermissionLevel(userType: UserType): number {
    return PERMISSION_LEVELS[userType] || 0;
  }
}