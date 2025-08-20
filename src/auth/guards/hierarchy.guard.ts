import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from '../../entities/user.entity';

// 계층적 권한 제어 관련 데코레이터
export const HIERARCHY_CHECK_KEY = 'hierarchyCheck';
export const ALLOW_PEER_ACCESS_KEY = 'allowPeerAccess';
export const HIERARCHY_SCOPE_KEY = 'hierarchyScope';

// 계층적 접근 제어 모드
export enum HierarchyMode {
  SUPERVISOR_ONLY = 'supervisor_only',     // 상급자만 하급자 접근 가능
  PEER_ALLOWED = 'peer_allowed',           // 동급자 간 접근 허용
  SUBORDINATE_READ = 'subordinate_read',   // 하급자가 상급자 읽기만 가능
  STRICT = 'strict'                        // 엄격한 계층 제어
}

export const HierarchyCheck = (mode: HierarchyMode = HierarchyMode.SUPERVISOR_ONLY) => 
  SetMetadata(HIERARCHY_CHECK_KEY, mode);

export const AllowPeerAccess = () => SetMetadata(ALLOW_PEER_ACCESS_KEY, true);

export const HierarchyScope = () => SetMetadata(HIERARCHY_SCOPE_KEY, true);

@Injectable()
export class HierarchyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUser = request.user;

    if (!currentUser) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // 계층적 권한 체크가 활성화된 경우만 실행
    const hierarchyMode = this.reflector.getAllAndOverride<HierarchyMode>(HIERARCHY_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!hierarchyMode) {
      return true; // 계층적 권한 체크가 비활성화된 경우 통과
    }

    // 최고 관리자는 모든 계층 접근 가능
    if (currentUser.user_type === UserType.SUPER_ADMIN) {
      return true;
    }

    const targetUserId = this.extractTargetUserId(request);
    
    // 자신의 정보에 접근하는 경우 허용
    if (targetUserId === currentUser.id) {
      return true;
    }

    // 특정 사용자를 대상으로 하지 않는 경우 (목록 조회 등)
    if (!targetUserId) {
      return await this.checkGeneralHierarchyAccess(currentUser, hierarchyMode);
    }

    // 특정 사용자에 대한 접근 권한 체크
    return await this.checkTargetUserAccess(currentUser, targetUserId, hierarchyMode, context);
  }

  /**
   * 특정 사용자에 대한 계층적 접근 권한 체크
   */
  private async checkTargetUserAccess(
    currentUser: any,
    targetUserId: number,
    mode: HierarchyMode,
    context: ExecutionContext
  ): Promise<boolean> {
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['supervisor', 'subordinates'],
      select: ['id', 'user_type', 'center_id', 'supervisor_id']
    });

    if (!targetUser) {
      throw new ForbiddenException('대상 사용자를 찾을 수 없습니다.');
    }

    switch (mode) {
      case HierarchyMode.SUPERVISOR_ONLY:
        return await this.checkSupervisorAccess(currentUser, targetUser);

      case HierarchyMode.PEER_ALLOWED:
        return await this.checkPeerOrSupervisorAccess(currentUser, targetUser);

      case HierarchyMode.SUBORDINATE_READ:
        return await this.checkSubordinateReadAccess(currentUser, targetUser, context);

      case HierarchyMode.STRICT:
        return await this.checkStrictAccess(currentUser, targetUser);

      default:
        return false;
    }
  }

  /**
   * 일반적인 계층 접근 권한 체크 (목록 조회 등)
   */
  private async checkGeneralHierarchyAccess(currentUser: any, mode: HierarchyMode): Promise<boolean> {
    // 관리자가 아닌 경우 자신의 정보만 접근 가능
    if (![UserType.STAFF, UserType.CENTER_MANAGER, UserType.REGIONAL_MANAGER, UserType.SUPER_ADMIN].includes(currentUser.user_type)) {
      return false;
    }

    return true;
  }

  /**
   * 상급자만 하급자에 접근 가능한 모드
   */
  private async checkSupervisorAccess(currentUser: any, targetUser: any): Promise<boolean> {
    // 현재 사용자가 대상 사용자의 직속 상급자인지 확인
    const isDirectSupervisor = await this.isDirectSupervisor(currentUser.id, targetUser.id);
    if (isDirectSupervisor) {
      return true;
    }

    // 간접 상급자인지 확인 (다단계 계층)
    const isIndirectSupervisor = await this.isIndirectSupervisor(currentUser.id, targetUser.id);
    if (isIndirectSupervisor) {
      return true;
    }

    // 권한 레벨이 더 높고 같은 센터인 경우
    const hasHigherAuthority = await this.hasHigherAuthorityInSameCenter(currentUser, targetUser);
    if (hasHigherAuthority) {
      return true;
    }

    throw new ForbiddenException('하급자의 정보에만 접근할 수 있습니다.');
  }

  /**
   * 동급자 간 접근도 허용하는 모드
   */
  private async checkPeerOrSupervisorAccess(currentUser: any, targetUser: any): Promise<boolean> {
    // 상급자 접근 체크
    const supervisorAccess = await this.checkSupervisorAccess(currentUser, targetUser).catch(() => false);
    if (supervisorAccess) {
      return true;
    }

    // 동급자 접근 체크 (같은 센터, 같은 레벨)
    const isPeer = await this.isPeer(currentUser, targetUser);
    if (isPeer) {
      return true;
    }

    throw new ForbiddenException('동급자 또는 하급자의 정보에만 접근할 수 있습니다.');
  }

  /**
   * 하급자가 상급자 정보를 읽기만 가능한 모드
   */
  private async checkSubordinateReadAccess(currentUser: any, targetUser: any, context: ExecutionContext): Promise<boolean> {
    const method = this.extractHttpMethod(context);
    
    // 읽기 작업이 아닌 경우 상급자 접근만 허용
    if (!['GET'].includes(method)) {
      return await this.checkSupervisorAccess(currentUser, targetUser);
    }

    // 읽기 작업인 경우 상급자/하급자 모두 허용
    const isRelated = await this.isHierarchyRelated(currentUser.id, targetUser.id);
    if (isRelated) {
      return true;
    }

    throw new ForbiddenException('계층 관계에 있는 사용자의 정보만 조회할 수 있습니다.');
  }

  /**
   * 엄격한 계층 제어 모드
   */
  private async checkStrictAccess(currentUser: any, targetUser: any): Promise<boolean> {
    // 직속 상급자만 접근 가능
    const isDirectSupervisor = await this.isDirectSupervisor(currentUser.id, targetUser.id);
    if (!isDirectSupervisor) {
      throw new ForbiddenException('직속 상급자만 접근할 수 있습니다.');
    }

    return true;
  }

  /**
   * 직속 상급자 관계 확인
   */
  private async isDirectSupervisor(supervisorId: number, subordinateId: number): Promise<boolean> {
    const subordinate = await this.userRepository.findOne({
      where: { id: subordinateId },
      select: ['supervisor_id']
    });

    return subordinate?.supervisor_id === supervisorId;
  }

  /**
   * 간접 상급자 관계 확인 (다단계 계층)
   */
  private async isIndirectSupervisor(potentialSupervisorId: number, subordinateId: number): Promise<boolean> {
    let currentUserId = subordinateId;
    const visitedIds = new Set<number>();

    while (currentUserId && !visitedIds.has(currentUserId)) {
      visitedIds.add(currentUserId);

      const user = await this.userRepository.findOne({
        where: { id: currentUserId },
        select: ['supervisor_id']
      });

      if (!user?.supervisor_id) {
        break;
      }

      if (user.supervisor_id === potentialSupervisorId) {
        return true;
      }

      currentUserId = user.supervisor_id;
    }

    return false;
  }

  /**
   * 같은 센터에서 더 높은 권한을 가지는지 확인
   */
  private async hasHigherAuthorityInSameCenter(currentUser: any, targetUser: any): Promise<boolean> {
    // 같은 센터가 아닌 경우 false
    if (currentUser.center_id !== targetUser.center_id) {
      return false;
    }

    const currentUserLevel = this.getUserLevel(currentUser.user_type);
    const targetUserLevel = this.getUserLevel(targetUser.user_type);

    return currentUserLevel > targetUserLevel;
  }

  /**
   * 동급자 관계 확인
   */
  private async isPeer(currentUser: any, targetUser: any): Promise<boolean> {
    // 같은 센터이고 같은 레벨인 경우
    return currentUser.center_id === targetUser.center_id && 
           currentUser.user_type === targetUser.user_type;
  }

  /**
   * 계층 관계에 있는지 확인 (상급자 또는 하급자)
   */
  private async isHierarchyRelated(userId1: number, userId2: number): Promise<boolean> {
    const isSupervisor = await this.isIndirectSupervisor(userId1, userId2);
    const isSubordinate = await this.isIndirectSupervisor(userId2, userId1);

    return isSupervisor || isSubordinate;
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

  /**
   * 요청에서 대상 사용자 ID 추출
   */
  private extractTargetUserId(request: any): number | null {
    // URL 파라미터에서 추출
    if (request.params?.userId) return parseInt(request.params.userId);
    if (request.params?.user_id) return parseInt(request.params.user_id);
    if (request.params?.staffId) return parseInt(request.params.staffId);
    if (request.params?.staff_id) return parseInt(request.params.staff_id);
    if (request.params?.managerId) return parseInt(request.params.managerId);
    if (request.params?.manager_id) return parseInt(request.params.manager_id);

    // 쿼리 파라미터에서 추출
    if (request.query?.userId) return parseInt(request.query.userId);
    if (request.query?.user_id) return parseInt(request.query.user_id);

    // 바디에서 추출
    if (request.body?.userId) return parseInt(request.body.userId);
    if (request.body?.user_id) return parseInt(request.body.user_id);

    return null;
  }

  /**
   * HTTP 메서드 추출
   */
  private extractHttpMethod(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    return request.method;
  }
}