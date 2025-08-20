import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from '../entities/user.entity';
import { HierarchyUtil, HierarchyUser } from '../common/utils/hierarchy.util';
import { HierarchyQueryUtil, HierarchyScope } from '../common/utils/hierarchy-query.util';
import { AuthAdapterUtil } from '../common/utils/auth-adapter.util';

@Injectable()
export class AdminHierarchyServiceExample {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * 계층적 권한에 따른 직원 목록 조회
   */
  async getStaffWithHierarchy(currentUser: HierarchyScope, mode: 'manage' | 'view' = 'manage'): Promise<User[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.center', 'center')
      .leftJoinAndSelect('user.supervisor', 'supervisor')
      .leftJoinAndSelect('user.subordinates', 'subordinates')
      .where('user.user_type IN (:...staffTypes)', {
        staffTypes: [UserType.STAFF, UserType.CENTER_MANAGER, UserType.REGIONAL_MANAGER]
      });

    // 계층적 권한 범위 적용
    await HierarchyQueryUtil.applyHierarchyScope(queryBuilder, this.userRepository, currentUser, 'user', mode);

    return await queryBuilder.getMany();
  }

  /**
   * 특정 사용자 정보 조회 (계층적 권한 체크)
   */
  async getUserWithHierarchyCheck(
    currentUser: HierarchyScope,
    targetUserId: number,
    operation: 'read' | 'write' = 'read'
  ): Promise<User> {
    // 접근 권한 확인
    const canAccess = await HierarchyQueryUtil.canAccessUser(
      this.userRepository,
      currentUser,
      targetUserId,
      operation
    );

    if (!canAccess) {
      throw new ForbiddenException('해당 사용자 정보에 접근할 권한이 없습니다.');
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['center', 'supervisor', 'subordinates']
    });

    if (!user) {
      throw new ForbiddenException('사용자를 찾을 수 없습니다.');
    }

    return user;
  }

  /**
   * 사용자 정보 수정 (계층적 권한 체크)
   */
  async updateUserWithHierarchyCheck(
    currentUser: HierarchyScope,
    targetUserId: number,
    updateData: Partial<User>
  ): Promise<User> {
    // 쓰기 권한 확인
    const canWrite = await HierarchyQueryUtil.canAccessUser(
      this.userRepository,
      currentUser,
      targetUserId,
      'write'
    );

    if (!canWrite) {
      throw new ForbiddenException('해당 사용자 정보를 수정할 권한이 없습니다.');
    }

    // 권한 상승 시도 방지
    if (updateData.user_type || updateData.supervisor_id !== undefined) {
      const canElevate = await this.canElevateUserPrivileges(currentUser, targetUserId, updateData);
      if (!canElevate) {
        throw new ForbiddenException('사용자의 권한을 상승시킬 수 없습니다.');
      }
    }

    await this.userRepository.update(targetUserId, updateData);
    return await this.getUserWithHierarchyCheck(currentUser, targetUserId, 'read');
  }

  /**
   * 상급자 설정 (계층 구조 관리)
   */
  async assignSupervisor(
    currentUser: HierarchyScope,
    subordinateId: number,
    newSupervisorId: number
  ): Promise<void> {
    // 하급자에 대한 관리 권한 확인
    const hierarchyUser = AuthAdapterUtil.hierarchyScopeToUser(currentUser);
    const canManageSubordinate = await HierarchyUtil.canManageUser(
      this.userRepository,
      hierarchyUser,
      subordinateId
    );

    if (!canManageSubordinate) {
      throw new ForbiddenException('해당 사용자의 상급자를 설정할 권한이 없습니다.');
    }

    // 새로운 상급자에 대한 접근 권한 확인
    const canAccessSupervisor = await HierarchyQueryUtil.canAccessUser(
      this.userRepository,
      currentUser,
      newSupervisorId,
      'read'
    );

    if (!canAccessSupervisor) {
      throw new ForbiddenException('지정할 상급자에 대한 권한이 없습니다.');
    }

    // 계층 구조 유효성 검증 (순환 참조 방지)
    const isValid = await HierarchyUtil.validateHierarchy(
      this.userRepository,
      subordinateId,
      newSupervisorId
    );

    if (!isValid) {
      throw new BadRequestException('유효하지 않은 계층 구조입니다. 순환 참조가 발생할 수 있습니다.');
    }

    // 상급자 설정
    await this.userRepository.update(subordinateId, { supervisor_id: newSupervisorId });
  }

  /**
   * 내 하급자 목록 조회
   */
  async getMySubordinates(currentUser: HierarchyScope, includeIndirect: boolean = false): Promise<User[]> {
    if (includeIndirect) {
      return await HierarchyUtil.getAllSubordinates(this.userRepository, currentUser.userId);
    } else {
      return await HierarchyUtil.getDirectSubordinates(this.userRepository, currentUser.userId);
    }
  }

  /**
   * 내 상급자 정보 조회
   */
  async getMySupervisor(currentUser: HierarchyScope): Promise<User | null> {
    if (!currentUser.supervisorId) {
      return null;
    }

    return await this.userRepository.findOne({
      where: { id: currentUser.supervisorId },
      relations: ['center'],
      select: ['id', 'name', 'user_type', 'center_id', 'email', 'phone'] // 민감정보 제외
    });
  }

  /**
   * 계층 구조 트리 조회
   */
  async getHierarchyTree(currentUser: HierarchyScope): Promise<any> {
    // 최고 관리자는 전체 트리 조회 가능
    if (currentUser.userType === UserType.SUPER_ADMIN) {
      // 최상위 관리자 찾기
      const topManager = await this.userRepository.findOne({
        where: { supervisor_id: null, user_type: UserType.SUPER_ADMIN },
        order: { created_at: 'ASC' }
      });

      if (topManager) {
        return await HierarchyUtil.buildHierarchyTree(this.userRepository, topManager.id);
      }
    }

    // 일반 사용자는 자신을 루트로 하는 트리만 조회
    return await HierarchyUtil.buildHierarchyTree(this.userRepository, currentUser.userId);
  }

  /**
   * 계층 관계 분석
   */
  async analyzeRelationship(
    currentUser: HierarchyScope,
    targetUserId: number
  ): Promise<{
    relationship: 'superior' | 'subordinate' | 'peer' | 'unrelated';
    canManage: boolean;
    canView: boolean;
    distance: number;
  }> {
    const relationship = await HierarchyUtil.getRelationship(
      this.userRepository,
      currentUser.userId,
      targetUserId
    );

    const canManage = await HierarchyQueryUtil.canAccessUser(
      this.userRepository,
      currentUser,
      targetUserId,
      'write'
    );

    const canView = await HierarchyQueryUtil.canAccessUser(
      this.userRepository,
      currentUser,
      targetUserId,
      'read'
    );

    // 계층 거리 계산
    let distance = 0;
    if (relationship === 'superior' || relationship === 'subordinate') {
      const currentPath = await HierarchyUtil.getHierarchyPath(this.userRepository, currentUser.userId);
      const targetPath = await HierarchyUtil.getHierarchyPath(this.userRepository, targetUserId);
      distance = Math.abs(currentPath.length - targetPath.length);
    }

    return {
      relationship,
      canManage,
      canView,
      distance
    };
  }

  /**
   * 권한 상승 가능 여부 확인
   */
  private async canElevateUserPrivileges(
    currentUser: HierarchyScope,
    targetUserId: number,
    updateData: Partial<User>
  ): Promise<boolean> {
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      select: ['id', 'user_type', 'supervisor_id']
    });

    if (!targetUser) {
      return false;
    }

    // 사용자 타입 변경 시 권한 체크
    if (updateData.user_type) {
      const currentLevel = this.getUserLevel(currentUser.userType);
      const newLevel = this.getUserLevel(updateData.user_type);
      const targetCurrentLevel = this.getUserLevel(targetUser.user_type);

      // 자신보다 높은 권한으로 상승시키려는 경우 차단
      if (newLevel >= currentLevel) {
        return false;
      }

      // 현재보다 높은 권한으로 상승시키려는 경우만 추가 체크
      if (newLevel > targetCurrentLevel) {
        // 최고 관리자만 권한 상승 가능
        return currentUser.userType === UserType.SUPER_ADMIN;
      }
    }

    // 상급자 변경 시 권한 체크
    if (updateData.supervisor_id !== undefined) {
      if (updateData.supervisor_id === null) {
        // 상급자 제거는 더 높은 권한 필요
        return [UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER].includes(currentUser.userType);
      }

      // 새로운 상급자에 대한 권한 확인
      const canAccessNewSupervisor = await HierarchyQueryUtil.canAccessUser(
        this.userRepository,
        currentUser,
        updateData.supervisor_id,
        'read'
      );

      return canAccessNewSupervisor;
    }

    return true;
  }

  /**
   * 사용자 권한 레벨 반환
   */
  private getUserLevel(userType: UserType): number {
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