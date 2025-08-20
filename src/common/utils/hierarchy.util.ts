import { Repository } from 'typeorm';
import { User, UserType } from '../../entities/user.entity';

export interface HierarchyUser {
  id: number;
  user_type: UserType;
  center_id?: number;
  supervisor_id?: number;
}

export interface HierarchyPath {
  userId: number;
  userType: UserType;
  level: number;
  path: number[];
}

export class HierarchyUtil {
  /**
   * 사용자의 모든 직속 하급자 조회
   */
  static async getDirectSubordinates(
    userRepository: Repository<User>,
    supervisorId: number
  ): Promise<User[]> {
    return await userRepository.find({
      where: { supervisor_id: supervisorId },
      relations: ['center', 'subordinates'],
      select: ['id', 'name', 'user_type', 'center_id', 'supervisor_id', 'email']
    });
  }

  /**
   * 사용자의 모든 하급자 조회 (다단계 포함)
   */
  static async getAllSubordinates(
    userRepository: Repository<User>,
    supervisorId: number
  ): Promise<User[]> {
    const allSubordinates: User[] = [];
    const visited = new Set<number>();

    const getSubordinatesRecursive = async (currentSupervisorId: number) => {
      if (visited.has(currentSupervisorId)) {
        return; // 순환 참조 방지
      }
      visited.add(currentSupervisorId);

      const directSubordinates = await this.getDirectSubordinates(userRepository, currentSupervisorId);
      
      for (const subordinate of directSubordinates) {
        allSubordinates.push(subordinate);
        await getSubordinatesRecursive(subordinate.id);
      }
    };

    await getSubordinatesRecursive(supervisorId);
    return allSubordinates;
  }

  /**
   * 사용자의 계층 경로 조회 (최상위까지)
   */
  static async getHierarchyPath(
    userRepository: Repository<User>,
    userId: number
  ): Promise<HierarchyPath[]> {
    const path: HierarchyPath[] = [];
    let currentUserId = userId;
    let level = 0;
    const visited = new Set<number>();

    while (currentUserId && !visited.has(currentUserId)) {
      visited.add(currentUserId);

      const user = await userRepository.findOne({
        where: { id: currentUserId },
        select: ['id', 'user_type', 'supervisor_id']
      });

      if (!user) {
        break;
      }

      path.unshift({
        userId: user.id,
        userType: user.user_type,
        level: level,
        path: []
      });

      currentUserId = user.supervisor_id || 0;
      level++;
    }

    // 각 노드에 전체 경로 설정
    const pathIds = path.map(p => p.userId);
    return path.map(p => ({ ...p, path: pathIds }));
  }

  /**
   * 두 사용자 간의 계층 관계 확인
   */
  static async getRelationship(
    userRepository: Repository<User>,
    user1Id: number,
    user2Id: number
  ): Promise<'superior' | 'subordinate' | 'peer' | 'unrelated'> {
    if (user1Id === user2Id) {
      return 'peer';
    }

    // User1이 User2의 상급자인지 확인
    const isUser1Superior = await this.isIndirectSupervisor(userRepository, user1Id, user2Id);
    if (isUser1Superior) {
      return 'superior';
    }

    // User1이 User2의 하급자인지 확인
    const isUser1Subordinate = await this.isIndirectSupervisor(userRepository, user2Id, user1Id);
    if (isUser1Subordinate) {
      return 'subordinate';
    }

    // 같은 상급자를 가지는지 확인 (동급자)
    const isPeer = await this.haveSameSupervisor(userRepository, user1Id, user2Id);
    if (isPeer) {
      return 'peer';
    }

    return 'unrelated';
  }

  /**
   * 간접 상급자 관계 확인
   */
  static async isIndirectSupervisor(
    userRepository: Repository<User>,
    supervisorId: number,
    subordinateId: number
  ): Promise<boolean> {
    let currentUserId = subordinateId;
    const visited = new Set<number>();

    while (currentUserId && !visited.has(currentUserId)) {
      visited.add(currentUserId);

      const user = await userRepository.findOne({
        where: { id: currentUserId },
        select: ['supervisor_id']
      });

      if (!user?.supervisor_id) {
        break;
      }

      if (user.supervisor_id === supervisorId) {
        return true;
      }

      currentUserId = user.supervisor_id;
    }

    return false;
  }

  /**
   * 같은 상급자를 가지는지 확인
   */
  static async haveSameSupervisor(
    userRepository: Repository<User>,
    user1Id: number,
    user2Id: number
  ): Promise<boolean> {
    const user1 = await userRepository.findOne({
      where: { id: user1Id },
      select: ['supervisor_id']
    });

    const user2 = await userRepository.findOne({
      where: { id: user2Id },
      select: ['supervisor_id']
    });

    return user1?.supervisor_id !== null && 
           user1?.supervisor_id === user2?.supervisor_id;
  }

  /**
   * 사용자가 관리할 수 있는 모든 사용자 ID 조회
   */
  static async getManageableUserIds(
    userRepository: Repository<User>,
    managerId: number
  ): Promise<number[]> {
    const subordinates = await this.getAllSubordinates(userRepository, managerId);
    return [managerId, ...subordinates.map(sub => sub.id)];
  }

  /**
   * 계층 구조를 트리 형태로 구성
   */
  static async buildHierarchyTree(
    userRepository: Repository<User>,
    rootUserId: number
  ): Promise<any> {
    const buildTree = async (userId: number): Promise<any> => {
      const user = await userRepository.findOne({
        where: { id: userId },
        select: ['id', 'name', 'user_type', 'center_id']
      });

      if (!user) {
        return null;
      }

      const directSubordinates = await this.getDirectSubordinates(userRepository, userId);
      const children = await Promise.all(
        directSubordinates.map(sub => buildTree(sub.id))
      );

      return {
        ...user,
        children: children.filter(child => child !== null)
      };
    };

    return await buildTree(rootUserId);
  }

  /**
   * 권한 레벨 기반 접근 가능 여부 확인
   */
  static canAccessByLevel(
    managerType: UserType,
    targetType: UserType,
    allowPeerAccess: boolean = false
  ): boolean {
    const levels = {
      [UserType.GENERAL]: 0,
      [UserType.EXPERT]: 1,
      [UserType.STAFF]: 2,
      [UserType.CENTER_MANAGER]: 3,
      [UserType.REGIONAL_MANAGER]: 4,
      [UserType.SUPER_ADMIN]: 5,
    };

    const managerLevel = levels[managerType] || 0;
    const targetLevel = levels[targetType] || 0;

    if (allowPeerAccess) {
      return managerLevel >= targetLevel;
    }

    return managerLevel > targetLevel;
  }

  /**
   * 계층 관계와 센터 관계를 모두 고려한 접근 권한 확인
   */
  static async canManageUser(
    userRepository: Repository<User>,
    manager: HierarchyUser,
    targetUserId: number
  ): Promise<boolean> {
    // 자신에 대한 접근은 항상 허용
    if (manager.id === targetUserId) {
      return true;
    }

    // 최고 관리자는 모든 사용자 관리 가능
    if (manager.user_type === UserType.SUPER_ADMIN) {
      return true;
    }

    const target = await userRepository.findOne({
      where: { id: targetUserId },
      select: ['id', 'user_type', 'center_id', 'supervisor_id']
    });

    if (!target) {
      return false;
    }

    // 직속 상급자 관계 확인
    if (target.supervisor_id === manager.id) {
      return true;
    }

    // 간접 상급자 관계 확인
    const isIndirectSupervisor = await this.isIndirectSupervisor(userRepository, manager.id, targetUserId);
    if (isIndirectSupervisor) {
      return true;
    }

    // 같은 센터에서 권한 레벨이 높은 경우
    if (manager.center_id === target.center_id) {
      return this.canAccessByLevel(manager.user_type, target.user_type, false);
    }

    return false;
  }

  /**
   * 하급자가 상급자 정보에 접근 가능한지 확인 (읽기 전용)
   */
  static async canSubordinateViewSuperior(
    userRepository: Repository<User>,
    subordinateId: number,
    superiorId: number,
    operation: 'read' | 'write' = 'read'
  ): Promise<boolean> {
    // 쓰기 작업은 항상 불허
    if (operation === 'write') {
      return false;
    }

    // 직속 상급자인 경우에만 읽기 허용
    const subordinate = await userRepository.findOne({
      where: { id: subordinateId },
      select: ['supervisor_id']
    });

    if (subordinate?.supervisor_id === superiorId) {
      return true;
    }

    // 간접 상급자도 읽기 허용할지는 정책에 따라 결정
    const isIndirectSuperior = await this.isIndirectSupervisor(userRepository, superiorId, subordinateId);
    return isIndirectSuperior;
  }

  /**
   * 계층 구조 유효성 검증 (순환 참조 방지)
   */
  static async validateHierarchy(
    userRepository: Repository<User>,
    userId: number,
    newSupervisorId: number
  ): Promise<boolean> {
    // 자기 자신을 상급자로 설정하는 것 방지
    if (userId === newSupervisorId) {
      return false;
    }

    // 새로운 상급자가 현재 사용자의 하급자인지 확인 (순환 참조 방지)
    const wouldCreateCycle = await this.isIndirectSupervisor(userRepository, userId, newSupervisorId);
    return !wouldCreateCycle;
  }
}