import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserType } from '../../entities/user.entity';
import { Center } from '../../entities/center.entity';

// 지역 범위 제어 관련 데코레이터
export const REGIONAL_SCOPE_KEY = 'regionalScope';
export const REGIONAL_HIERARCHY_KEY = 'regionalHierarchy';

export const RegionalScope = () => SetMetadata(REGIONAL_SCOPE_KEY, true);
export const RegionalHierarchy = () => SetMetadata(REGIONAL_HIERARCHY_KEY, true);

@Injectable()
export class RegionalScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Center)
    private centerRepository: Repository<Center>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // 지역 범위 제어가 활성화된 경우만 체크
    const regionalScopeEnabled = this.reflector.getAllAndOverride<boolean>(REGIONAL_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!regionalScopeEnabled) {
      return true; // 지역 범위 제어가 비활성화된 경우 통과
    }

    // 최고 관리자는 모든 지역 접근 가능
    if (user.user_type === UserType.SUPER_ADMIN) {
      return true;
    }

    // 지역 관리자는 자신의 지역만 관리 가능
    if (user.user_type === UserType.REGIONAL_MANAGER) {
      return await this.checkRegionalManagerAccess(user, request);
    }

    // 센터장과 직원은 지역 관리 기능 접근 불가 (자신의 센터 정보만 조회 가능)
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type)) {
      const hierarchyEnabled = this.reflector.getAllAndOverride<boolean>(REGIONAL_HIERARCHY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      
      if (hierarchyEnabled) {
        return await this.checkCenterStaffAccess(user, request);
      }
      
      throw new ForbiddenException('지역 관리 권한이 없습니다.');
    }

    throw new ForbiddenException('지역 관리 권한이 없습니다.');
  }

  /**
   * 지역 관리자의 접근 권한 체크
   */
  private async checkRegionalManagerAccess(user: any, request: any): Promise<boolean> {
    if (!user.center_id) {
      throw new ForbiddenException('지역 관리자의 소속 센터(지역본부)가 설정되지 않았습니다.');
    }

    const targetCenterId = this.extractCenterIdFromRequest(request);
    const targetRegionId = this.extractRegionIdFromRequest(request);

    // 특정 센터에 대한 접근인 경우
    if (targetCenterId) {
      return await this.checkCenterInRegion(user.center_id, targetCenterId);
    }

    // 특정 지역에 대한 접근인 경우
    if (targetRegionId) {
      if (user.center_id !== targetRegionId) {
        throw new ForbiddenException('담당 지역이 아닙니다.');
      }
    }

    return true;
  }

  /**
   * 센터장/직원의 계층적 접근 권한 체크
   */
  private async checkCenterStaffAccess(user: any, request: any): Promise<boolean> {
    if (!user.center_id) {
      throw new ForbiddenException('소속 센터가 설정되지 않았습니다.');
    }

    const targetCenterId = this.extractCenterIdFromRequest(request);
    
    // 자신의 센터 정보만 조회 가능
    if (targetCenterId && user.center_id !== targetCenterId) {
      throw new ForbiddenException('자신의 센터 정보만 조회할 수 있습니다.');
    }

    return true;
  }

  /**
   * 특정 센터가 지역 관리자의 담당 지역에 속하는지 확인
   */
  private async checkCenterInRegion(regionalCenterId: number, targetCenterId: number): Promise<boolean> {
    // 타겟 센터가 지역본부 센터 자체인 경우
    if (regionalCenterId === targetCenterId) {
      return true;
    }

    // 타겟 센터의 상위 센터 조회
    const targetCenter = await this.centerRepository.findOne({
      where: { id: targetCenterId },
      relations: ['parentCenter']
    });

    if (!targetCenter) {
      throw new ForbiddenException('존재하지 않는 센터입니다.');
    }

    // 타겟 센터의 상위 센터가 지역본부 센터인지 확인
    if (targetCenter.parent_center_id === regionalCenterId) {
      return true;
    }

    // 다단계 계층 구조인 경우 재귀적으로 확인
    if (targetCenter.parent_center_id) {
      return await this.checkCenterInRegion(regionalCenterId, targetCenter.parent_center_id);
    }

    throw new ForbiddenException('담당 지역이 아닌 센터입니다.');
  }

  /**
   * 지역 관리자가 관리하는 모든 센터 ID 조회
   */
  async getManagedCenterIds(regionalCenterId: number): Promise<number[]> {
    const allCenters = await this.centerRepository.find({
      select: ['id', 'parent_center_id']
    });

    const managedCenterIds: number[] = [regionalCenterId]; // 지역본부 센터 포함

    // 재귀적으로 하위 센터들 찾기
    const findSubCenters = (parentId: number) => {
      const subCenters = allCenters.filter(center => center.parent_center_id === parentId);
      subCenters.forEach(center => {
        managedCenterIds.push(center.id);
        findSubCenters(center.id); // 재귀 호출
      });
    };

    findSubCenters(regionalCenterId);
    return managedCenterIds;
  }

  /**
   * 요청에서 센터 ID 추출
   */
  private extractCenterIdFromRequest(request: any): number | null {
    if (request.params?.centerId) return parseInt(request.params.centerId);
    if (request.params?.center_id) return parseInt(request.params.center_id);
    if (request.query?.centerId) return parseInt(request.query.centerId);
    if (request.query?.center_id) return parseInt(request.query.center_id);
    if (request.body?.centerId) return parseInt(request.body.centerId);
    if (request.body?.center_id) return parseInt(request.body.center_id);
    return null;
  }

  /**
   * 요청에서 지역 ID 추출
   */
  private extractRegionIdFromRequest(request: any): number | null {
    if (request.params?.regionId) return parseInt(request.params.regionId);
    if (request.params?.region_id) return parseInt(request.params.region_id);
    if (request.query?.regionId) return parseInt(request.query.regionId);
    if (request.query?.region_id) return parseInt(request.query.region_id);
    if (request.body?.regionId) return parseInt(request.body.regionId);
    if (request.body?.region_id) return parseInt(request.body.region_id);
    return null;
  }
}