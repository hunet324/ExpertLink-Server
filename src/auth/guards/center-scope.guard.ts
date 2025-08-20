import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserType } from '../../entities/user.entity';
import { Center } from '../../entities/center.entity';

// 센터 범위 제어 관련 데코레이터
export const CENTER_SCOPE_KEY = 'centerScope';
export const ALLOW_CROSS_CENTER_KEY = 'allowCrossCenter';

export const CenterScope = () => SetMetadata(CENTER_SCOPE_KEY, true);
export const AllowCrossCenter = () => SetMetadata(ALLOW_CROSS_CENTER_KEY, true);

@Injectable()
export class CenterScopeGuard implements CanActivate {
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

    // 센터 범위 제어가 활성화된 경우만 체크
    const centerScopeEnabled = this.reflector.getAllAndOverride<boolean>(CENTER_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!centerScopeEnabled) {
      return true; // 센터 범위 제어가 비활성화된 경우 통과
    }

    // 크로스 센터 접근이 허용된 경우 체크
    const allowCrossCenter = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_CENTER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 최고 관리자는 모든 센터 접근 가능
    if (user.user_type === UserType.SUPER_ADMIN) {
      return true;
    }

    // 지역 관리자는 담당 지역의 센터들만 접근 가능
    if (user.user_type === UserType.REGIONAL_MANAGER) {
      return await this.checkRegionalAccess(user, request);
    }

    // 센터장과 직원은 자신의 센터만 접근 가능
    if ([UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type)) {
      return await this.checkCenterAccess(user, request, allowCrossCenter);
    }

    // 일반 사용자와 전문가는 센터 관리 기능 접근 불가
    throw new ForbiddenException('센터 관리 권한이 없습니다.');
  }

  /**
   * 지역 관리자의 접근 권한 체크
   */
  private async checkRegionalAccess(user: any, request: any): Promise<boolean> {
    const targetCenterId = this.extractCenterIdFromRequest(request);
    
    if (!targetCenterId) {
      return true; // 특정 센터를 타겟하지 않는 경우 허용
    }

    if (!user.center_id) {
      throw new ForbiddenException('지역 관리자의 소속 센터가 설정되지 않았습니다.');
    }

    // 지역 관리자가 관리하는 센터들 조회
    const managedCenters = await this.getManagedCenters(user.center_id);
    const managedCenterIds = managedCenters.map(center => center.id);

    if (!managedCenterIds.includes(targetCenterId)) {
      throw new ForbiddenException('담당 지역이 아닌 센터에는 접근할 수 없습니다.');
    }

    return true;
  }

  /**
   * 센터장/직원의 접근 권한 체크
   */
  private async checkCenterAccess(user: any, request: any, allowCrossCenter: boolean): Promise<boolean> {
    const targetCenterId = this.extractCenterIdFromRequest(request);
    
    if (!targetCenterId) {
      return true; // 특정 센터를 타겟하지 않는 경우 허용
    }

    if (!user.center_id) {
      throw new ForbiddenException('소속 센터가 설정되지 않았습니다.');
    }

    // 크로스 센터 접근이 허용된 경우 (예: 센터 간 협업 기능)
    if (allowCrossCenter) {
      return true;
    }

    // 자신의 센터만 접근 허용
    if (user.center_id !== targetCenterId) {
      throw new ForbiddenException('자신의 센터에만 접근할 수 있습니다.');
    }

    return true;
  }

  /**
   * 지역 관리자가 관리하는 센터들 조회
   */
  private async getManagedCenters(regionalCenterId: number): Promise<Center[]> {
    // 지역본부 센터를 parent_center_id로 가지는 모든 센터들 조회
    const subCenters = await this.centerRepository.find({
      where: { parent_center_id: regionalCenterId },
      relations: ['parentCenter']
    });

    // 지역본부 센터 자체도 포함
    const regionalCenter = await this.centerRepository.findOne({
      where: { id: regionalCenterId }
    });

    return regionalCenter ? [regionalCenter, ...subCenters] : subCenters;
  }

  /**
   * 요청에서 센터 ID 추출
   */
  private extractCenterIdFromRequest(request: any): number | null {
    // URL 파라미터에서 centerId 추출
    if (request.params?.centerId) {
      return parseInt(request.params.centerId);
    }

    // URL 파라미터에서 center_id 추출
    if (request.params?.center_id) {
      return parseInt(request.params.center_id);
    }

    // 쿼리 파라미터에서 centerId 추출  
    if (request.query?.centerId) {
      return parseInt(request.query.centerId);
    }

    // 쿼리 파라미터에서 center_id 추출
    if (request.query?.center_id) {
      return parseInt(request.query.center_id);
    }

    // 바디에서 centerId 추출
    if (request.body?.centerId) {
      return parseInt(request.body.centerId);
    }

    // 바디에서 center_id 추출
    if (request.body?.center_id) {
      return parseInt(request.body.center_id);
    }

    return null;
  }
}