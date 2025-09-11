import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType, UserStatus } from '../entities/user.entity';
import { Counseling, CounselingStatus } from '../entities/counseling.entity';
import { ClientSearchDto } from './dto/client-search.dto';
import { ClientListResponseDto, ClientDetailResponseDto } from './dto/client-response.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Counseling)
    private counselingsRepository: Repository<Counseling>,
  ) {}

  async getMyClients(userId: number, searchDto: ClientSearchDto): Promise<{
    clients: ClientListResponseDto[];
    total: number;
    page: number;
    total_pages: number;
  }> {
    const { search, status, sort = 'registration_date', order = 'DESC', page = 1, limit = 10 } = searchDto;

    try {
      console.log('[getMyClients] userId:', userId);

      // 사용자의 전문가 프로필 조회
      const user = await this.usersRepository.findOne({
        where: { id: userId },
        relations: ['expertProfile']
      });

      if (!user) {
        throw new ForbiddenException('사용자를 찾을 수 없습니다.');
      }

      if (!user.expertProfile) {
        console.error('[getMyClients] Expert profile not found for userId:', userId);
        // 전문가 프로필이 없는 경우 빈 목록 반환
        return {
          clients: [],
          total: 0,
          page,
          total_pages: 0
        };
      }

      // counselings.expert_id는 users.id를 참조 (expert_profiles.id가 아님)
      const expertUserId = userId;
      console.log('[getMyClients] expertUserId:', expertUserId);

    // 간단한 쿼리로 변경 - 복잡한 JOIN 제거
    const baseQuery = this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('counselings', 'counseling', 'counseling.user_id = user.id')
      .where('user.user_type = :userType', { userType: UserType.GENERAL })
      .andWhere('counseling.expert_id = :expertUserId', { expertUserId })
      .select([
        'DISTINCT user.id as user_id',
        'user.name as user_name',
        'user.email as user_email', 
        'user.phone as user_phone',
        'user.status as user_status',
        'user.signup_date as user_signup_date',
        'user.bio as user_bio'
      ]);

    // 검색 필터
    if (search) {
      baseQuery.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // 상태 필터
    if (status && status !== 'all') {
      if (status === 'active') {
        baseQuery.andWhere('user.status = :status', { status: UserStatus.ACTIVE });
      } else if (status === 'inactive') {
        baseQuery.andWhere('user.status = :status', { status: UserStatus.INACTIVE });
      }
    }

    // 정렬
    const sortField = this.getSortField(sort);
    baseQuery.orderBy(sortField, order);

    // 페이지네이션
    const offset = (page - 1) * limit;
    const [results, total] = await Promise.all([
      baseQuery.offset(offset).limit(limit).getRawMany(),
      baseQuery.getCount()
    ]);

    // 각 내담자의 상담 통계를 별도로 조회
    const clientsWithStats = await Promise.all(
      results.map(async (result) => {
        // 해당 내담자의 상담 통계 조회 (통합 상담 시스템)
        const stats = await this.counselingsRepository
          .createQueryBuilder('counseling')
          .select([
            'COUNT(counseling.id) as total_sessions',
            'MAX(counseling.schedule_date) as last_session_date'
          ])
          .where('counseling.user_id = :userId', { userId: result.user_id })
          .andWhere('counseling.expert_id = :expertUserId', { expertUserId })
          .andWhere('counseling.status = :status', { status: CounselingStatus.COMPLETED })
          .getRawOne();

        // bio 필드에서 메모만 추출
        let displayNotes = '';
        try {
          if (result.user_bio) {
            const parsed = JSON.parse(result.user_bio);
            displayNotes = parsed.additional_info?.notes || parsed.bio || '';
          }
        } catch (error) {
          // JSON 파싱 실패 시 원본 bio 사용
          displayNotes = result.user_bio || '';
        }

        return {
          id: result.user_id,
          name: result.user_name,
          email: result.user_email,
          phone: result.user_phone,
          user_type: 'general',
          status: result.user_status,
          // age 필드 제거
          signup_date: result.user_signup_date,
          total_sessions: parseInt(stats.total_sessions) || 0,
          last_session_date: stats.last_session_date,
          next_session_date: null,
          notes: displayNotes
        };
      })
    );

    return {
      clients: clientsWithStats.map(client => 
        plainToClass(ClientListResponseDto, client, {
          excludeExtraneousValues: true,
        })
      ),
      total,
      page,
      total_pages: Math.ceil(total / limit),
    };
    } catch (error) {
      console.error('[getMyClients] Error:', error);
      throw error;
    }
  }

  async getClientDetail(clientId: number, userId: number): Promise<ClientDetailResponseDto> {
    try {
      console.log('[getClientDetail] userId:', userId, 'clientId:', clientId);

      // 사용자의 전문가 프로필 조회
      const user = await this.usersRepository.findOne({
        where: { id: userId },
        relations: ['expertProfile']
      });

      if (!user) {
        throw new ForbiddenException('사용자를 찾을 수 없습니다.');
      }

      if (!user.expertProfile) {
        throw new ForbiddenException('전문가 프로필을 찾을 수 없습니다.');
      }

      // counselings.expert_id는 users.id를 참조 (expert_profiles.id가 아님)
      const expertUserId = userId;
      console.log('[getClientDetail] expertUserId:', expertUserId);

    // 내담자와 상담 관계 확인
    const counselingRelation = await this.counselingsRepository.findOne({
      where: { 
        user_id: clientId,
        expert_id: expertUserId  // users.id를 사용
      }
    });

    console.log('[getClientDetail] counselingRelation found:', !!counselingRelation);

    if (!counselingRelation) {
      throw new ForbiddenException('해당 내담자와 상담 관계가 없습니다.');
    }

    // 내담자 상세 정보 조회 (user_type 체크 완화)
    const client = await this.usersRepository.findOne({
      where: { id: clientId }
    });

    if (!client) {
      throw new NotFoundException('내담자를 찾을 수 없습니다.');
    }

    // 일반 사용자가 아닌 경우 경고 로그
    if (client.user_type !== UserType.GENERAL) {
      console.warn(`[getClientDetail] Client ${clientId} is not GENERAL type (${client.user_type})`);
    }

    // 최근 상담 세션 조회 (통합 상담 시스템)
    const recentSessions = await this.counselingsRepository
      .createQueryBuilder('counseling')
      .where('counseling.user_id = :clientId', { clientId })
      .andWhere('counseling.expert_id = :expertUserId', { expertUserId })
      .orderBy('counseling.created_at', 'DESC')
      .limit(5)
      .getMany();

    // bio 필드에서 추가 정보 파싱
    let additionalInfo = null;
    let bio = client.bio || '';
    
    try {
      if (client.bio) {
        const parsed = JSON.parse(client.bio);
        if (parsed.additional_info) {
          additionalInfo = parsed.additional_info;
          bio = parsed.bio || '';
        }
      }
    } catch (error) {
      // JSON 파싱 실패 시 기존 bio를 그대로 사용
      bio = client.bio || '';
    }

    const clientDetail = {
      ...client,
      bio,
      total_sessions: recentSessions.length,
      last_session_date: recentSessions[0]?.created_at,
      next_session_date: null, // TODO: 다음 예정 일정 조회
      emergency_contact: {
        name: '',
        relationship: '',
        phone: ''
      },
      primary_concerns: additionalInfo?.primary_concerns || [],
      medical_history: additionalInfo?.medical_history || '',
      current_medications: additionalInfo?.current_medications || '',
      previous_therapy: additionalInfo?.previous_therapy || '',
      risk_assessment: {
        suicide_risk: additionalInfo?.risk_assessment?.suicide_risk || 'low',
        self_harm_risk: additionalInfo?.risk_assessment?.self_harm_risk || 'low',
        notes: additionalInfo?.risk_assessment?.notes || ''
      },
      treatment_goals: additionalInfo?.treatment_goals || [],
      notes: additionalInfo?.notes || client.bio || '',
      recent_sessions: recentSessions.map(session => ({
        id: session.id,
        date: session.schedule_date || session.created_at,
        type: session.type,
        duration: session.duration || 60,
        summary: session.reason || '상담 진행',
        status: session.status
      })),
      assessment_results: []
    };

    return plainToClass(ClientDetailResponseDto, clientDetail, {
      excludeExtraneousValues: true,
    });
    } catch (error) {
      console.error('[getClientDetail] Error:', error);
      throw error;
    }
  }

  private calculateAge(signupDate: Date): number {
    const today = new Date();
    const birth = new Date(signupDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return Math.max(age, 18); // 최소 연령 18세
  }

  async searchAllClients(expertId: number, searchTerm?: string): Promise<ClientListResponseDto[]> {
    // 전문가 권한 확인
    const expert = await this.usersRepository.findOne({
      where: { id: expertId, user_type: UserType.EXPERT }
    });

    if (!expert) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    // 모든 일반 사용자(내담자) 검색 (상담 관계 무관)
    let query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.user_type = :userType', { userType: UserType.GENERAL })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .select([
        'user.id as user_id',
        'user.name as user_name',
        'user.email as user_email',
        'user.phone as user_phone',
        'user.signup_date as user_signup_date'
      ]);

    // 검색어 필터
    if (searchTerm) {
      query.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${searchTerm}%` }
      );
    }

    query.orderBy('user.name', 'ASC').limit(20); // 최대 20개 결과

    const results = await query.getRawMany();

    return results.map(result => ({
      id: result.user_id,
      name: result.user_name,
      email: result.user_email,
      phone: result.user_phone,
      user_type: 'general',
      status: 'active',
      signup_date: result.user_signup_date,
      total_sessions: 0,
      last_session_date: null,
      next_session_date: null,
      notes: ''
    }));
  }

  async updateClient(clientId: number, userId: number, updateDto: UpdateClientDto): Promise<ClientDetailResponseDto> {
    // 사용자의 전문가 프로필 조회
    const user = await this.usersRepository.findOne({
      where: { id: userId, user_type: UserType.EXPERT },
      relations: ['expertProfile']
    });

    if (!user || !user.expertProfile) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    const expertId = user.expertProfile.id;

    // 내담자와 상담 관계 확인
    const counselingRelation = await this.counselingsRepository.findOne({
      where: { 
        user_id: clientId,
        expert_id: expertId
      }
    });

    if (!counselingRelation) {
      throw new ForbiddenException('해당 내담자와 상담 관계가 없습니다.');
    }

    // 내담자 정보 조회
    const client = await this.usersRepository.findOne({
      where: { id: clientId, user_type: UserType.GENERAL }
    });

    if (!client) {
      throw new NotFoundException('내담자를 찾을 수 없습니다.');
    }

    // 기본 정보 업데이트 (users 테이블 필드만)
    const updateData: Partial<User> = {};
    if (updateDto.name) updateData.name = updateDto.name;
    if (updateDto.email) updateData.email = updateDto.email;
    if (updateDto.phone) updateData.phone = updateDto.phone;
    if (updateDto.bio) updateData.bio = updateDto.bio;
    if (updateDto.status) updateData.status = updateDto.status as UserStatus;

    // 추가 정보는 bio 필드에 JSON으로 저장
    const additionalInfo = {
      primary_concerns: updateDto.primary_concerns,
      risk_assessment: updateDto.risk_assessment,
      treatment_goals: updateDto.treatment_goals,
      medical_history: updateDto.medical_history,
      current_medications: updateDto.current_medications,
      previous_therapy: updateDto.previous_therapy,
      notes: updateDto.notes
    };

    // bio 필드에 기존 내용과 추가 정보를 함께 저장
    updateData.bio = JSON.stringify({
      bio: updateDto.bio || client.bio || '',
      additional_info: additionalInfo
    });

    await this.usersRepository.update(clientId, updateData);

    // 업데이트된 상세 정보 반환
    return await this.getClientDetail(clientId, userId);
  }

  private getSortField(sort: string): string {
    const sortMap = {
      name: 'user.name',
      registration_date: 'user.signup_date',
      last_session: 'user.signup_date', // 임시로 signup_date 사용
    };

    return sortMap[sort] || 'user.signup_date';
  }
}