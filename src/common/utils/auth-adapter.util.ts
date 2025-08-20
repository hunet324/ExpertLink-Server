import { AuthenticatedUser } from '../interfaces/auth.interface';
import { ScopeUser } from './query-scope.util';

export class AuthAdapterUtil {
  /**
   * AuthenticatedUser를 ScopeUser로 변환
   */
  static toScopeUser(authUser: AuthenticatedUser): ScopeUser {
    return {
      id: authUser.id || authUser.userId,
      user_type: authUser.user_type,
      center_id: authUser.center_id || authUser.centerId,
    };
  }

  /**
   * AuthenticatedUser를 HierarchyScope로 변환
   */
  static toHierarchyScope(authUser: AuthenticatedUser): any {
    return {
      userId: authUser.userId || authUser.id,
      userType: authUser.user_type, // UserType enum 사용
      centerId: authUser.center_id || authUser.centerId,
      supervisorId: authUser.supervisor_id || authUser.supervisorId,
    };
  }

  /**
   * AuthenticatedUser를 HierarchyUser로 변환
   */
  static toHierarchyUser(authUser: AuthenticatedUser): any {
    return {
      id: authUser.id || authUser.userId,
      user_type: authUser.user_type,
      center_id: authUser.center_id || authUser.centerId,
      supervisor_id: authUser.supervisor_id || authUser.supervisorId,
    };
  }

  /**
   * HierarchyScope를 HierarchyUser로 변환
   */
  static hierarchyScopeToUser(scope: any): any {
    return {
      id: scope.userId,
      user_type: scope.userType,
      center_id: scope.centerId,
      supervisor_id: scope.supervisorId,
    };
  }
}