import { Repository, SelectQueryBuilder } from 'typeorm';
import { User, UserType } from '../../entities/user.entity';
import { HierarchyUtil } from './hierarchy.util';

export interface HierarchyScope {
  userId: number;
  userType: UserType;
  centerId?: number;
  supervisorId?: number;
}

export class HierarchyQueryUtil {
  /**
   * 계층적 권한에 따른 사용자 쿼리 범위 적용
   */
  static async applyHierarchyScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    userRepository: Repository<User>,
    currentUser: HierarchyScope,
    userAlias: string = 'user',
    mode: 'manage' | 'view' | 'strict' = 'manage'
  ): Promise<SelectQueryBuilder<T>> {
    // 최고 관리자는 모든 사용자 접근 가능
    if (currentUser.userType === UserType.SUPER_ADMIN) {
      return queryBuilder;
    }

    switch (mode) {
      case 'manage':
        return await this.applyManageScope(queryBuilder, userRepository, currentUser, userAlias);
      
      case 'view':
        return await this.applyViewScope(queryBuilder, userRepository, currentUser, userAlias);
      
      case 'strict':
        return await this.applyStrictScope(queryBuilder, userRepository, currentUser, userAlias);
      
      default:
        return queryBuilder;
    }
  }

  /**
   * 관리 권한 범위 적용 (상급자가 하급자만 관리)
   */
  private static async applyManageScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    userRepository: Repository<User>,
    currentUser: HierarchyScope,
    userAlias: string
  ): Promise<SelectQueryBuilder<T>> {
    // 관리 가능한 사용자 ID 목록 조회
    const manageableUserIds = await HierarchyUtil.getManageableUserIds(userRepository, currentUser.userId);

    if (manageableUserIds.length === 0) {
      // 관리할 수 있는 사용자가 없는 경우
      queryBuilder.andWhere('1 = 0');
    } else {
      queryBuilder.andWhere(`${userAlias}.id IN (:...manageableUserIds)`, { manageableUserIds });
    }

    return queryBuilder;
  }

  /**
   * 조회 권한 범위 적용 (상급자/하급자 모두 조회 가능)
   */
  private static async applyViewScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    userRepository: Repository<User>,
    currentUser: HierarchyScope,
    userAlias: string
  ): Promise<SelectQueryBuilder<T>> {
    // 관리 가능한 사용자들
    const manageableUserIds = await HierarchyUtil.getManageableUserIds(userRepository, currentUser.userId);
    
    // 계층 경로상의 상급자들
    const hierarchyPath = await HierarchyUtil.getHierarchyPath(userRepository, currentUser.userId);
    const superiorIds = hierarchyPath.map(p => p.userId).filter(id => id !== currentUser.userId);

    const viewableUserIds = [...new Set([...manageableUserIds, ...superiorIds])];

    if (viewableUserIds.length === 0) {
      queryBuilder.andWhere(`${userAlias}.id = :currentUserId`, { currentUserId: currentUser.userId });
    } else {
      queryBuilder.andWhere(`${userAlias}.id IN (:...viewableUserIds)`, { viewableUserIds });
    }

    return queryBuilder;
  }

  /**
   * 엄격한 권한 범위 적용 (직속 관계만)
   */
  private static async applyStrictScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    userRepository: Repository<User>,
    currentUser: HierarchyScope,
    userAlias: string
  ): Promise<SelectQueryBuilder<T>> {
    // 직속 하급자들만
    const directSubordinates = await HierarchyUtil.getDirectSubordinates(userRepository, currentUser.userId);
    const subordinateIds = directSubordinates.map(sub => sub.id);

    if (subordinateIds.length === 0) {
      queryBuilder.andWhere(`${userAlias}.id = :currentUserId`, { currentUserId: currentUser.userId });
    } else {
      queryBuilder.andWhere(
        `${userAlias}.id IN (:currentUserId, :...subordinateIds)`, 
        { currentUserId: currentUser.userId, subordinateIds }
      );
    }

    return queryBuilder;
  }

  /**
   * 하급자의 상급자 정보 접근 제한
   */
  static applySubordinateRestriction<T>(
    queryBuilder: SelectQueryBuilder<T>,
    currentUser: HierarchyScope,
    userAlias: string = 'user',
    operation: 'read' | 'write' = 'read'
  ): SelectQueryBuilder<T> {
    // 쓰기 작업에서는 상급자 정보 완전 차단
    if (operation === 'write') {
      // 권한 레벨이 낮은 사용자는 권한 레벨이 높은 사용자 수정 불가
      const currentLevel = this.getUserLevel(currentUser.userType);
      
      // 자신보다 높은 레벨의 사용자 접근 차단
      const higherLevelTypes = this.getHigherLevelTypes(currentUser.userType);
      if (higherLevelTypes.length > 0) {
        queryBuilder.andWhere(`${userAlias}.user_type NOT IN (:...higherLevelTypes)`, { higherLevelTypes });
      }
    }

    return queryBuilder;
  }

  /**
   * 센터와 계층을 모두 고려한 복합 권한 적용
   */
  static async applyHybridScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    userRepository: Repository<User>,
    currentUser: HierarchyScope,
    userAlias: string = 'user'
  ): Promise<SelectQueryBuilder<T>> {
    // 최고 관리자는 모든 접근 허용
    if (currentUser.userType === UserType.SUPER_ADMIN) {
      return queryBuilder;
    }

    // 지역 관리자는 담당 지역 + 계층 관계
    if (currentUser.userType === UserType.REGIONAL_MANAGER) {
      const manageableUserIds = await HierarchyUtil.getManageableUserIds(userRepository, currentUser.userId);
      
      queryBuilder.andWhere(
        `(${userAlias}.center_id = :currentCenterId OR ${userAlias}.id IN (:...manageableUserIds))`,
        { 
          currentCenterId: currentUser.centerId,
          manageableUserIds: manageableUserIds.length > 0 ? manageableUserIds : [0] // 빈 배열 방지
        }
      );
      
      return queryBuilder;
    }

    // 센터장과 직원은 센터 + 계층 관계
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(currentUser.userType)) {
      const manageableUserIds = await HierarchyUtil.getManageableUserIds(userRepository, currentUser.userId);
      
      // 같은 센터 내에서만 계층 관계 적용
      queryBuilder.andWhere(
        `(${userAlias}.center_id = :currentCenterId AND ${userAlias}.id IN (:...manageableUserIds))`,
        { 
          currentCenterId: currentUser.centerId,
          manageableUserIds: manageableUserIds.length > 0 ? manageableUserIds : [currentUser.userId]
        }
      );
      
      return queryBuilder;
    }

    // 일반 사용자와 전문가는 자신만
    queryBuilder.andWhere(`${userAlias}.id = :currentUserId`, { currentUserId: currentUser.userId });
    
    return queryBuilder;
  }

  /**
   * 특정 사용자에 대한 접근 권한 확인
   */
  static async canAccessUser(
    userRepository: Repository<User>,
    currentUser: HierarchyScope,
    targetUserId: number,
    operation: 'read' | 'write' = 'read'
  ): Promise<boolean> {
    // 자신에 대한 접근은 항상 허용
    if (currentUser.userId === targetUserId) {
      return true;
    }

    // 최고 관리자는 모든 접근 허용
    if (currentUser.userType === UserType.SUPER_ADMIN) {
      return true;
    }

    const targetUser = await userRepository.findOne({
      where: { id: targetUserId },
      select: ['id', 'user_type', 'center_id', 'supervisor_id']
    });

    if (!targetUser) {
      return false;
    }

    // 하급자가 상급자에 접근하는 경우
    const relationship = await HierarchyUtil.getRelationship(userRepository, currentUser.userId, targetUserId);
    
    if (relationship === 'subordinate') {
      // 하급자가 상급자 정보에 접근하는 경우
      if (operation === 'write') {
        return false; // 쓰기는 항상 불허
      }
      
      // 읽기는 직속 상급자만 허용
      return await HierarchyUtil.canSubordinateViewSuperior(userRepository, currentUser.userId, targetUserId, operation);
    }

    // 상급자가 하급자에 접근하는 경우
    if (relationship === 'superior') {
      return true;
    }

    // 동급자 접근 (같은 센터 내에서만)
    if (relationship === 'peer' && currentUser.centerId === targetUser.center_id) {
      return operation === 'read'; // 동급자는 읽기만 허용
    }

    return false;
  }

  /**
   * 사용자 권한 레벨 반환
   */
  private static getUserLevel(userType: UserType): number {
    const levels = {
      [UserType.GENERAL]: 0,
      [UserType.EXPERT]: 1,
      [UserType.STAFF]: 2,
      [UserType.CENTER_MANAGER]: 3,
      [UserType.REGIONAL_MANAGER]: 4,
      [UserType.SUPER_ADMIN]: 5,
    };
    return levels[userType] || 0;
  }

  /**
   * 현재 사용자보다 높은 레벨의 사용자 타입들 반환
   */
  private static getHigherLevelTypes(currentUserType: UserType): UserType[] {
    const currentLevel = this.getUserLevel(currentUserType);
    const allTypes = [
      UserType.GENERAL,
      UserType.EXPERT,
      UserType.STAFF,
      UserType.CENTER_MANAGER,
      UserType.REGIONAL_MANAGER,
      UserType.SUPER_ADMIN
    ];

    return allTypes.filter(type => this.getUserLevel(type) > currentLevel);
  }
}