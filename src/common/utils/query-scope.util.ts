import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserType } from '../../entities/user.entity';
import { Center } from '../../entities/center.entity';

export interface ScopeUser {
  user_type: UserType;
  center_id?: number;
  id: number;
}

export class QueryScopeUtil {
  /**
   * 사용자의 권한에 따라 센터 관련 쿼리에 WHERE 조건 추가
   */
  static applyCenterScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    user: ScopeUser,
    centerAlias: string = 'center'
  ): SelectQueryBuilder<T> {
    // 최고 관리자는 모든 센터 접근 가능
    if (user.user_type === UserType.SUPER_ADMIN) {
      return queryBuilder;
    }

    // 지역 관리자는 담당 지역의 센터들만 접근 가능
    if (user.user_type === UserType.REGIONAL_MANAGER) {
      if (user.center_id) {
        queryBuilder.andWhere(
          `(${centerAlias}.id = :userCenterId OR ${centerAlias}.parent_center_id = :userCenterId)`,
          { userCenterId: user.center_id }
        );
      }
      return queryBuilder;
    }

    // 센터장과 직원은 자신의 센터만 접근 가능
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type)) {
      if (user.center_id) {
        queryBuilder.andWhere(`${centerAlias}.id = :userCenterId`, { userCenterId: user.center_id });
      } else {
        // 센터가 설정되지 않은 경우 접근 불가
        queryBuilder.andWhere('1 = 0');
      }
      return queryBuilder;
    }

    // 일반 사용자와 전문가는 센터 관리 데이터 접근 불가
    queryBuilder.andWhere('1 = 0');
    return queryBuilder;
  }

  /**
   * 사용자의 권한에 따라 직원(User) 관련 쿼리에 WHERE 조건 추가
   */
  static applyUserScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    user: ScopeUser,
    userAlias: string = 'user'
  ): SelectQueryBuilder<T> {
    // 최고 관리자는 모든 사용자 접근 가능
    if (user.user_type === UserType.SUPER_ADMIN) {
      return queryBuilder;
    }

    // 지역 관리자는 담당 지역의 사용자들만 접근 가능
    if (user.user_type === UserType.REGIONAL_MANAGER) {
      if (user.center_id) {
        queryBuilder
          .leftJoin(`${userAlias}.center`, `${userAlias}_center`)
          .andWhere(
            `(${userAlias}.center_id = :userCenterId OR ${userAlias}_center.parent_center_id = :userCenterId)`,
            { userCenterId: user.center_id }
          );
      }
      return queryBuilder;
    }

    // 센터장은 자신의 센터 직원들만 접근 가능
    if (user.user_type === UserType.CENTER_MANAGER) {
      if (user.center_id) {
        queryBuilder.andWhere(`${userAlias}.center_id = :userCenterId`, { userCenterId: user.center_id });
      } else {
        queryBuilder.andWhere('1 = 0');
      }
      return queryBuilder;
    }

    // 직원은 자신의 정보만 접근 가능
    if (user.user_type === UserType.STAFF) {
      queryBuilder.andWhere(`${userAlias}.id = :userId`, { userId: user.id });
      return queryBuilder;
    }

    // 일반 사용자와 전문가는 관리자 데이터 접근 불가
    queryBuilder.andWhere('1 = 0');
    return queryBuilder;
  }

  /**
   * 사용자의 권한에 따라 전문가 관련 쿼리에 WHERE 조건 추가
   */
  static applyExpertScope<T>(
    queryBuilder: SelectQueryBuilder<T>,
    user: ScopeUser,
    expertAlias: string = 'expert'
  ): SelectQueryBuilder<T> {
    // 최고 관리자는 모든 전문가 접근 가능
    if (user.user_type === UserType.SUPER_ADMIN) {
      return queryBuilder;
    }

    // 지역 관리자는 담당 지역의 전문가들만 접근 가능
    if (user.user_type === UserType.REGIONAL_MANAGER) {
      if (user.center_id) {
        queryBuilder
          .leftJoin(`${expertAlias}.center`, `${expertAlias}_center`)
          .andWhere(
            `(${expertAlias}.center_id = :userCenterId OR ${expertAlias}_center.parent_center_id = :userCenterId)`,
            { userCenterId: user.center_id }
          );
      }
      return queryBuilder;
    }

    // 센터장과 직원은 자신의 센터 전문가들만 접근 가능
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type)) {
      if (user.center_id) {
        queryBuilder.andWhere(`${expertAlias}.center_id = :userCenterId`, { userCenterId: user.center_id });
      } else {
        queryBuilder.andWhere('1 = 0');
      }
      return queryBuilder;
    }

    // 일반 사용자와 전문가는 관리 데이터 접근 불가
    queryBuilder.andWhere('1 = 0');
    return queryBuilder;
  }

  /**
   * 관리 가능한 센터 ID 목록 조회
   */
  static async getManagedCenterIds(
    centerRepository: Repository<Center>,
    user: ScopeUser
  ): Promise<number[]> {
    // 최고 관리자는 모든 센터
    if (user.user_type === UserType.SUPER_ADMIN) {
      const allCenters = await centerRepository.find({ select: ['id'] });
      return allCenters.map(center => center.id);
    }

    // 지역 관리자는 담당 지역의 센터들
    if (user.user_type === UserType.REGIONAL_MANAGER && user.center_id) {
      const subCenters = await centerRepository.find({
        where: { parent_center_id: user.center_id },
        select: ['id']
      });
      return [user.center_id, ...subCenters.map(center => center.id)];
    }

    // 센터장과 직원은 자신의 센터만
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type) && user.center_id) {
      return [user.center_id];
    }

    return [];
  }

  /**
   * 특정 센터에 대한 접근 권한 확인
   */
  static async canAccessCenter(
    centerRepository: Repository<Center>,
    user: ScopeUser,
    targetCenterId: number
  ): Promise<boolean> {
    const managedCenterIds = await this.getManagedCenterIds(centerRepository, user);
    return managedCenterIds.includes(targetCenterId);
  }

  /**
   * 계층적 권한 체크 (상급자가 하급자 관리)
   */
  static canManageUser(manager: ScopeUser, target: { user_type: UserType; center_id?: number }): boolean {
    // 같은 레벨이거나 더 높은 레벨은 관리 불가
    const managerLevel = this.getUserLevel(manager.user_type);
    const targetLevel = this.getUserLevel(target.user_type);
    
    if (managerLevel <= targetLevel) {
      return false;
    }

    // 센터 범위 체크
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(manager.user_type)) {
      return manager.center_id === target.center_id;
    }

    return true;
  }

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
}