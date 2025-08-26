import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { User, UserType, UserStatus } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { Counseling, CounselingStatus } from '../entities/counseling.entity';
import { Content } from '../entities/content.entity';
import { PsychTest } from '../entities/psych-test.entity';
import { PsychQuestion, QuestionType } from '../entities/psych-question.entity';
import { PsychResult } from '../entities/psych-result.entity';
import { LogicRule } from '../entities/logic-rule.entity';
import { SystemLog, LogLevel, LogCategory } from '../entities/system-log.entity';
import { Payment } from '../entities/payment.entity';
import { Notification } from '../entities/notification.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Schedule, ScheduleStatus } from '../entities/schedule.entity';
import { AdminDashboardStatsDto } from './dto/admin-stats.dto';
import { AdminUserQueryDto, AdminUserListResponseDto, AdminUserDto, UserStatusUpdateDto, UserStatusUpdateResponseDto } from './dto/admin-user-management.dto';
import { ExpertVerificationDto, ExpertVerificationResponseDto, PendingExpertsListDto } from './dto/expert-verification.dto';
import { UpdateExpertComprehensiveDto, UpdateExpertComprehensiveResponseDto } from './dto/update-expert-comprehensive.dto';
import { SystemLogQueryDto, SystemLogListResponseDto, SystemLogResponseDto, SystemLogStatsDto } from './dto/system-log.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';
import { plainToClass } from 'class-transformer';
import { UsersService } from '../users/users.service';
import { CreateInitialAdminDto } from './dto/create-initial-admin.dto';
import { LoggerUtil } from '../common/utils/logger.util';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ExpertProfile)
    private expertProfileRepository: Repository<ExpertProfile>,
    @InjectRepository(Counseling)
    private counselingRepository: Repository<Counseling>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(PsychTest)
    private psychTestRepository: Repository<PsychTest>,
    @InjectRepository(PsychResult)
    private psychResultRepository: Repository<PsychResult>,
    @InjectRepository(LogicRule)
    private logicRuleRepository: Repository<LogicRule>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(Schedule)
    private schedulesRepository: Repository<Schedule>,
    @InjectRepository(PsychQuestion)
    private psychQuestionRepository: Repository<PsychQuestion>,
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  async createInitialAdmin(createDto: CreateInitialAdminDto): Promise<User> {
    // 이미 관리자 계정이 존재하는지 확인
    const existingAdmin = await this.userRepository.findOne({
      where: { user_type: UserType.SUPER_ADMIN },
    });

    if (existingAdmin) {
      throw new ConflictException('이미 관리자 계정이 존재합니다.');
    }

    // 이메일 중복 확인 (일반 사용자 포함)
    const existingUser = await this.userRepository.findOne({
      where: { email: createDto.email },
    });

    if (existingUser) {
      throw new ConflictException('해당 이메일로 이미 계정이 존재합니다.');
    }

    // 관리자 계정 생성
    const adminUser = await this.usersService.create({
      email: createDto.email,
      password: createDto.password,
      name: createDto.name,
      phone: createDto.phone,
      user_type: UserType.SUPER_ADMIN,
    });

    return adminUser;
  }
  
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    const [
      userStats,
      expertStats,
      counselingStats,
      contentStats,
      psychTestStats,
      systemStats,
    ] = await Promise.all([
      this.getUserStats(),
      this.getExpertStats(),
      this.getCounselingStats(),
      this.getContentStats(),
      this.getPsychTestStats(),
      this.getSystemStats(),
    ]);

    return {
      users: userStats,
      experts: expertStats,
      counselings: counselingStats,
      contents: contentStats,
      psych_tests: psychTestStats,
      system: systemStats,
      generated_at: new Date(),
    };
  }

  async getUsers(query: AdminUserQueryDto): Promise<AdminUserListResponseDto> {
    // 기본 사용자 정보만 먼저 조회 (성능 최적화)
    const baseQueryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.expertProfile', 'expert');

    // 필터링 적용
    this.applyUserFilters(baseQueryBuilder, query);

    // 정렬 적용
    this.applyUserSorting(baseQueryBuilder, query);

    // 전체 개수 조회
    const total = await baseQueryBuilder.getCount();

    // 페이지네이션 적용하여 기본 사용자 정보 조회
    const users = await baseQueryBuilder
      .skip(query.offset)
      .take(query.limit)
      .getMany();

    // 조회된 사용자들의 ID 배열 (빈 배열 처리)
    const userIds = users.map(user => user.id);

    // 사용자가 없으면 빈 결과 반환
    if (userIds.length === 0) {
      return {
        users: [],
        total,
        page: query.page,
        limit: query.limit,
        total_pages: Math.ceil(total / query.limit),
      };
    }

    // 안전한 placeholder 생성 (SQL 인젝션 방지)
    const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
    
    // Map 변수들을 상위 스코프에 선언
    let counselingMap = new Map();
    let paymentMap = new Map();
    let loginMap = new Map();
    let contentMap = new Map();
    let psychTestMap = new Map();
    
    try {
      // 통계 데이터를 순차적으로 조회 (연결 과부하 방지)
      const counselingStats = await this.userRepository.query(`
        SELECT 
          user_id,
          COUNT(DISTINCT c1.id) as user_counseling_count,
          COUNT(DISTINCT CASE WHEN c1.status = 'completed' THEN c1.id END) as user_completed_sessions,
          COUNT(DISTINCT c2.id) as expert_counseling_count,
          COUNT(DISTINCT CASE WHEN c2.status = 'completed' THEN c2.id END) as expert_completed_sessions
        FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
        LEFT JOIN counselings c1 ON c1.user_id = u.user_id
        LEFT JOIN counselings c2 ON c2.expert_id = u.user_id
        GROUP BY user_id
      `, userIds);

      const paymentStats = await this.userRepository.query(`
        SELECT user_id, COALESCE(SUM(amount), 0) as total_payments
        FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
        LEFT JOIN payments p ON p.user_id = u.user_id AND p.status = 'completed'
        GROUP BY user_id
      `, userIds);

      const loginStats = await this.userRepository.query(`
        SELECT 
          user_id, 
          COUNT(CASE WHEN sl.id IS NOT NULL THEN 1 END) as login_count, 
          MAX(sl.timestamp) as last_login_at
        FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
        LEFT JOIN system_logs sl ON sl.user_id = u.user_id AND sl.action = 'USER_LOGIN'
        GROUP BY user_id
      `, userIds);

      // 병렬로 처리할 수 있는 가벼운 쿼리들
      const [contentStats, psychTestStats] = await Promise.all([
        this.userRepository.query(`
          SELECT user_id, COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END) as content_count
          FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
          LEFT JOIN contents c ON c.author_id = u.user_id
          GROUP BY user_id
        `, userIds),

        this.userRepository.query(`
          SELECT user_id, COUNT(CASE WHEN pr.id IS NOT NULL THEN 1 END) as psych_test_count
          FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
          LEFT JOIN psych_results pr ON pr.user_id = u.user_id
          GROUP BY user_id
        `, userIds)
      ]);

      // 통계 데이터를 Map으로 변환 (빠른 조회를 위해) - 메모리 효율성 개선

      // 안전한 데이터 변환
      counselingStats.forEach(stat => {
        if (stat && stat.user_id) {
          counselingMap.set(parseInt(stat.user_id), stat);
        }
      });
      
      paymentStats.forEach(stat => {
        if (stat && stat.user_id) {
          paymentMap.set(parseInt(stat.user_id), stat);
        }
      });

      loginStats.forEach(stat => {
        if (stat && stat.user_id) {
          loginMap.set(parseInt(stat.user_id), stat);
        }
      });

      contentStats.forEach(stat => {
        if (stat && stat.user_id) {
          contentMap.set(parseInt(stat.user_id), stat);
        }
      });

      psychTestStats.forEach(stat => {
        if (stat && stat.user_id) {
          psychTestMap.set(parseInt(stat.user_id), stat);
        }
      });

    } catch (error) {
      // 통계 조회 실패 시 기본값으로 처리 (서비스 중단 방지)
      console.error('사용자 통계 조회 중 오류 발생:', error);
      
      const userDtos = users.map(user => {
        const userDto = plainToClass(AdminUserDto, user, { excludeExtraneousValues: true });
        
        // 기본값으로 설정
        userDto.counseling_count = 0;
        userDto.content_count = 0;
        userDto.psych_test_count = 0;
        userDto.total_sessions = 0;
        userDto.total_payments = 0;
        userDto.login_count = 0;
        userDto.last_login_at = null;
        userDto.is_verified = user.expertProfile?.is_verified || false;
        userDto.email_verified = !!user.email;
        userDto.phone_verified = !!user.phone;
        
        return userDto;
      });

      return {
        users: userDtos,
        total,
        page: query.page,
        limit: query.limit,
        total_pages: Math.ceil(total / query.limit),
      };
    }

    // 최종 결과 조합 (정상 처리)
    const userDtos = users.map(user => {
      const userDto = plainToClass(AdminUserDto, user, { excludeExtraneousValues: true });
      
      const counselingStat = counselingMap.get(user.id);
      const paymentStat = paymentMap.get(user.id);
      const loginStat = loginMap.get(user.id);
      const contentStat = contentMap.get(user.id);
      const psychTestStat = psychTestMap.get(user.id);

      // 기본 통계
      userDto.is_verified = user.expertProfile?.is_verified || false;
      
      // 안전한 숫자 변환 함수
      const safeParseInt = (value: any, defaultValue: number = 0): number => {
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      // 상담 통계 (사용자 타입에 따라 다르게 처리)
      if (user.user_type === 'expert') {
        userDto.counseling_count = safeParseInt(counselingStat?.expert_counseling_count);
        userDto.total_sessions = safeParseInt(counselingStat?.expert_completed_sessions);
      } else {
        userDto.counseling_count = safeParseInt(counselingStat?.user_counseling_count);
        userDto.total_sessions = safeParseInt(counselingStat?.user_completed_sessions);
      }

      // 기타 통계 (안전한 변환)
      userDto.content_count = safeParseInt(contentStat?.content_count);
      userDto.psych_test_count = safeParseInt(psychTestStat?.psych_test_count);
      userDto.total_payments = safeParseInt(paymentStat?.total_payments);
      userDto.login_count = safeParseInt(loginStat?.login_count);
      
      // 안전한 날짜 처리
      try {
        userDto.last_login_at = loginStat?.last_login_at ? new Date(loginStat.last_login_at) : null;
      } catch (dateError) {
        userDto.last_login_at = null;
      }
      
      // 인증 상태
      userDto.email_verified = !!user.email;
      userDto.phone_verified = !!user.phone;
      
      return userDto;
    });

    const totalPages = Math.ceil(total / query.limit);

    return {
      users: userDtos,
      total,
      page: query.page,
      limit: query.limit,
      total_pages: totalPages,
    };
  }

  async updateUserStatus(userId: number, updateDto: UserStatusUpdateDto, adminId: number): Promise<UserStatusUpdateResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (user.status === updateDto.status) {
      throw new BadRequestException('이미 해당 상태입니다.');
    }

    const oldStatus = user.status;
    user.status = updateDto.status;
    
    await this.userRepository.save(user);

    // 사용자에게 상태 변경 알림 전송
    const statusMessages = {
      [UserStatus.ACTIVE]: '계정이 활성화되었습니다.',
      [UserStatus.INACTIVE]: '계정이 비활성화되었습니다.',
      [UserStatus.WITHDRAWN]: '계정이 탈퇴 처리되었습니다.',
      [UserStatus.PENDING]: '계정이 승인 대기 상태로 변경되었습니다.',
    };

    await this.notificationsService.createNotification(
      userId,
      '계정 상태 변경 알림',
      statusMessages[updateDto.status] + (updateDto.reason ? ` 사유: ${updateDto.reason}` : ''),
      NotificationType.SYSTEM,
    );

    return {
      message: '사용자 상태가 성공적으로 변경되었습니다.',
      user_id: userId,
      old_status: oldStatus,
      new_status: updateDto.status,
      updated_at: new Date(),
    };
  }

  async getPendingExperts(): Promise<PendingExpertsListDto> {
    // 미검증 전문가 프로필들과 PENDING 상태 전문가 사용자들 조회
    const [pendingUsers, unverifiedExperts] = await Promise.all([
      // PENDING 상태의 전문가 사용자들만 조회 (일반 회원과 관리자는 자동 ACTIVE)
      this.userRepository.find({
        where: { 
          status: UserStatus.PENDING,
          user_type: UserType.EXPERT // 전문가만 조회 (DB 컬럼명은 user_type)
        },
        order: { created_at: 'DESC' },
      }),
      // 미검증 전문가 프로필들
      this.expertProfileRepository.find({
        where: { is_verified: false },
        relations: ['user'],
        order: { created_at: 'DESC' },
      })
    ]);

    const pendingList = [];

    // PENDING 상태 전문가 사용자들 추가 (프로필은 없지만 승인 대기 중)
    pendingUsers.forEach(user => {
      pendingList.push({
        id: null, // 전문가 프로필 ID가 없으므로 null
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        user_type: user.user_type,
        user_status: user.status,
        specialization: null,
        license_number: null,
        license_type: null,
        years_experience: null,
        education: null,
        career_history: null,
        introduction: null,
        hourly_rate: null,
        created_at: user.created_at,
        verification_documents: [],
        is_expert_profile: false,
      });
    });

    // 미검증 전문가들 추가 (프로필은 있지만 검증 대기 중)
    unverifiedExperts.forEach(expert => {
      pendingList.push({
        id: expert.id,
        user_id: expert.user_id,
        user_name: expert.user.name,
        user_email: expert.user.email,
        user_type: expert.user.user_type,
        user_status: expert.user.status,
        specialization: expert.specialization,
        license_number: expert.license_number,
        license_type: expert.license_type,
        years_experience: expert.years_experience,
        education: expert.education,
        career_history: expert.career_history,
        introduction: expert.introduction,
        hourly_rate: expert.hourly_rate,
        created_at: expert.created_at,
        verification_documents: [], // 실제로는 파일 업로드 시스템과 연동
        is_expert_profile: true,
      });
    });

    // 생성일시 기준으로 최신순 정렬
    pendingList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      experts: pendingList,
      total: pendingList.length,
      pending_count: pendingList.length,
    };
  }

  async verifyExpert(expertId: number, verificationDto: any, adminId: number): Promise<ExpertVerificationResponseDto> {
    LoggerUtil.debug('Service received expertId', { expertId, type: typeof expertId });
    LoggerUtil.debug('Service received verificationDto', verificationDto);
    
    let expertProfile;
    
    if (expertId === null || expertId === 0 || isNaN(expertId)) {
      // PENDING 사용자의 경우: user_id로 사용자를 찾아 프로필 생성
      if (!verificationDto.user_id) {
        throw new NotFoundException('사용자 ID가 필요합니다.');
      }
      
      LoggerUtil.debug('Looking for user with', {
        id: verificationDto.user_id,
        user_type: UserType.EXPERT,
        status: UserStatus.PENDING
      });
      
      const user = await this.userRepository.findOne({
        where: { 
          id: verificationDto.user_id, 
          user_type: UserType.EXPERT,
          status: UserStatus.PENDING 
        }
      });
      
      LoggerUtil.debug('Found user', { found: user ? 'YES' : 'NO', user });
      
      if (!user) {
        throw new NotFoundException('전문가 사용자를 찾을 수 없습니다.');
      }
      
      // 이미 프로필이 있는지 확인
      const existingProfile = await this.expertProfileRepository.findOne({
        where: { user_id: user.id },
        relations: ['user'],
      });
      
      if (existingProfile) {
        expertProfile = existingProfile;
      } else {
        // 새로운 프로필 생성
        expertProfile = this.expertProfileRepository.create({
          user_id: user.id,
          user,
          specialization: [],
          years_experience: 0,
          hourly_rate: 0,
          is_verified: verificationDto.is_verified,
          verification_date: new Date(),
        });
        
        expertProfile = await this.expertProfileRepository.save(expertProfile);
      }
    } else {
      // 기존 프로필이 있는 경우
      expertProfile = await this.expertProfileRepository.findOne({
        where: { id: expertId },
        relations: ['user'],
      });

      if (!expertProfile) {
        throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
      }
    }

    // 승인/거절 처리
    expertProfile.is_verified = verificationDto.is_verified;
    expertProfile.verification_date = new Date();

    await this.expertProfileRepository.save(expertProfile);

    // 승인/거절에 따른 사용자 상태 변경
    if (verificationDto.is_verified) {
      // 승인인 경우 ACTIVE로 변경
      expertProfile.user.status = UserStatus.ACTIVE;
    } else {
      // 거절인 경우 INACTIVE로 변경
      expertProfile.user.status = UserStatus.INACTIVE;
    }
    await this.userRepository.save(expertProfile.user);

    // 전문가에게 승인/거절 알림 전송
    const message = verificationDto.is_verified
      ? '전문가 승인이 완료되었습니다. 이제 상담 서비스를 제공할 수 있습니다.'
      : '전문가 승인이 거절되었습니다. 추가 정보가 필요할 수 있습니다.';

    await this.notificationsService.createNotification(
      expertProfile.user_id,
      verificationDto.is_verified ? '전문가 승인 완료' : '전문가 승인 거절',
      message + (verificationDto.verification_note ? ` 참고사항: ${verificationDto.verification_note}` : ''),
      NotificationType.SYSTEM,
    );

    return {
      message: verificationDto.is_verified ? '전문가가 승인되었습니다.' : '전문가 승인이 거절되었습니다.',
      expert_id: expertProfile.id,
      expert_name: expertProfile.user.name,
      is_verified: verificationDto.is_verified,
      verification_note: verificationDto.verification_note,
      verification_date: new Date(),
      verified_by: adminId,
    };
  }

  private async getUserStats() {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      inactiveUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: UserStatus.ACTIVE } }),
      this.userRepository.count({ where: { status: UserStatus.PENDING } }),
      this.userRepository.count({ where: { status: UserStatus.INACTIVE } }),
      this.userRepository
        .createQueryBuilder('user')
        .where('DATE(user.created_at) = CURRENT_DATE')
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where('user.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where('user.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
        .getCount(),
    ]);

    return {
      total_users: totalUsers,
      active_users: activeUsers,
      pending_users: pendingUsers,
      inactive_users: inactiveUsers,
      new_users_today: newUsersToday,
      new_users_this_week: newUsersThisWeek,
      new_users_this_month: newUsersThisMonth,
    };
  }

  private async getExpertStats() {
    const [totalExperts, verifiedExperts, pendingVerification, activeExperts] = await Promise.all([
      this.expertProfileRepository.count(),
      this.expertProfileRepository.count({ where: { is_verified: true } }),
      this.expertProfileRepository.count({ where: { is_verified: false } }),
      this.userRepository.count({ where: { user_type: UserType.EXPERT, status: UserStatus.ACTIVE } }),
    ]);

    return {
      total_experts: totalExperts,
      verified_experts: verifiedExperts,
      pending_verification: pendingVerification,
      active_experts: activeExperts,
      average_rating: 4.5, // 실제로는 리뷰 시스템에서 계산
    };
  }

  private async getCounselingStats() {
    const [
      totalCounselings,
      completedCounselings,
      pendingCounselings,
      cancelledCounselings,
      counselingsToday,
      counselingsThisWeek,
      counselingsThisMonth,
    ] = await Promise.all([
      this.counselingRepository.count(),
      this.counselingRepository.count({ where: { status: CounselingStatus.COMPLETED } }),
      this.counselingRepository.count({ where: { status: CounselingStatus.PENDING } }),
      this.counselingRepository.count({ where: { status: CounselingStatus.CANCELLED } }),
      this.counselingRepository
        .createQueryBuilder('counseling')
        .where('DATE(counseling.created_at) = CURRENT_DATE')
        .getCount(),
      this.counselingRepository
        .createQueryBuilder('counseling')
        .where('counseling.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
        .getCount(),
      this.counselingRepository
        .createQueryBuilder('counseling')
        .where('counseling.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
        .getCount(),
    ]);

    return {
      total_counselings: totalCounselings,
      completed_counselings: completedCounselings,
      pending_counselings: pendingCounselings,
      cancelled_counselings: cancelledCounselings,
      counselings_today: counselingsToday,
      counselings_this_week: counselingsThisWeek,
      counselings_this_month: counselingsThisMonth,
      average_session_duration: 60, // 실제로는 세션 시간 데이터에서 계산
    };
  }

  private async getContentStats() {
    const [
      totalContents,
      publishedContents,
      draftContents,
      totalViews,
      totalLikes,
    ] = await Promise.all([
      this.contentRepository.count(),
      this.contentRepository.count({ where: { status: 'published' as any } }),
      this.contentRepository.count({ where: { status: 'draft' as any } }),
      this.contentRepository
        .createQueryBuilder('content')
        .select('SUM(content.view_count)', 'total')
        .getRawOne()
        .then(result => parseInt(result?.total) || 0),
      this.contentRepository
        .createQueryBuilder('content')
        .select('SUM(content.like_count)', 'total')
        .getRawOne()
        .then(result => parseInt(result?.total) || 0),
    ]);

    const mostViewedContent = await this.contentRepository.findOne({
      where: { status: 'published' as any },
      order: { view_count: 'DESC' },
      select: ['id', 'title', 'view_count'],
    });

    return {
      total_contents: totalContents,
      published_contents: publishedContents,
      draft_contents: draftContents,
      total_views: totalViews,
      total_likes: totalLikes,
      most_viewed_content: mostViewedContent ? {
        id: mostViewedContent.id,
        title: mostViewedContent.title,
        views: mostViewedContent.view_count,
      } : null,
    };
  }

  private async getPsychTestStats() {
    const [
      totalTests,
      activeTests,
      totalResponses,
      responsesToday,
      responsesThisWeek,
      responsesThisMonth,
    ] = await Promise.all([
      this.psychTestRepository.count(),
      this.psychTestRepository.count({ where: { is_active: true } }),
      this.psychResultRepository.count(),
      this.psychResultRepository
        .createQueryBuilder('result')
        .where('DATE(result.completed_at) = CURRENT_DATE')
        .getCount(),
      this.psychResultRepository
        .createQueryBuilder('result')
        .where('result.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
        .getCount(),
      this.psychResultRepository
        .createQueryBuilder('result')
        .where('result.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
        .getCount(),
    ]);

    const mostPopularTest = await this.dataSource
      .createQueryBuilder()
      .select([
        'test.id as id',
        'test.title as title',
        'COUNT(result.id) as response_count'
      ])
      .from(PsychTest, 'test')
      .leftJoin(PsychResult, 'result', 'result.test_id = test.id')
      .where('test.is_active = true')
      .groupBy('test.id, test.title')
      .orderBy('response_count', 'DESC')
      .limit(1)
      .getRawOne();

    return {
      total_tests: totalTests,
      active_tests: activeTests,
      total_responses: totalResponses,
      responses_today: responsesToday,
      responses_this_week: responsesThisWeek,
      responses_this_month: responsesThisMonth,
      most_popular_test: mostPopularTest ? {
        id: mostPopularTest.id,
        title: mostPopularTest.title,
        response_count: parseInt(mostPopularTest.response_count),
      } : null,
    };
  }

  private async getSystemStats() {
    const [
      totalNotifications,
      unreadNotifications,
      chatMessagesToday,
      loginSessionsToday,
    ] = await Promise.all([
      this.notificationRepository.count(),
      this.notificationRepository.count({ where: { is_read: false } }),
      this.chatMessageRepository
        .createQueryBuilder('message')
        .where('DATE(message.created_at) = CURRENT_DATE')
        .getCount(),
      // 로그인 세션은 실제 구현 시 세션 테이블에서 조회
      Promise.resolve(0),
    ]);

    return {
      total_notifications: totalNotifications,
      unread_notifications: unreadNotifications,
      chat_messages_today: chatMessagesToday,
      login_sessions_today: loginSessionsToday,
      server_uptime: process.uptime().toString() + ' seconds',
      database_size: '0 MB', // 실제로는 DB 쿼리로 조회
    };
  }

  private applyUserFilters(queryBuilder: SelectQueryBuilder<User>, query: AdminUserQueryDto) {
    // camelCase 또는 snake_case 둘 다 지원
    const userType = query.user_type || query.userType;
    if (userType) {
      queryBuilder.andWhere('user.user_type = :userType', { userType });
    }

    if (query.status) {
      queryBuilder.andWhere('user.status = :status', { status: query.status });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    const centerId = query.center_id || query.centerId;
    if (centerId) {
      queryBuilder.andWhere('user.center_id = :centerId', { centerId });
    }
  }

  private applyUserSorting(queryBuilder: SelectQueryBuilder<User>, query: AdminUserQueryDto) {
    // camelCase 또는 snake_case 둘 다 지원
    const sortBy = query.sort_by || query.sortBy || 'created_at';
    const sortOrder = query.sort_order || query.sortOrder || 'DESC';
    
    switch (sortBy) {
      case 'name':
        queryBuilder.orderBy('user.name', sortOrder);
        break;
      case 'email':
        queryBuilder.orderBy('user.email', sortOrder);
        break;
      case 'last_login':
        queryBuilder.orderBy('user.updated_at', sortOrder); // 실제로는 last_login 필드
        break;
      case 'created_at':
      default:
        queryBuilder.orderBy('user.created_at', sortOrder);
        break;
    }
  }

  /**
   * 특정 사용자 조회
   */
  async getUserById(userId: number): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['expertProfile'],
      select: [
        'id', 'name', 'email', 'phone', 'user_type', 'center_id', 
        'supervisor_id', 'status', 'created_at', 'updated_at'
      ]
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const response: any = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      user_type: user.user_type,
      center_id: user.center_id,
      supervisor_id: user.supervisor_id,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    // 전문가인 경우 ExpertProfile 정보 추가
    if (user.user_type === UserType.EXPERT && user.expertProfile) {
      response.bio = user.expertProfile.introduction;
      response.specialties = user.expertProfile.specialization || [];
      response.yearsExperience = user.expertProfile.years_experience;
      response.hourlyRate = user.expertProfile.hourly_rate;
      response.licenseType = user.expertProfile.license_type;
      response.licenseNumber = user.expertProfile.license_number;
      response.isVerified = user.expertProfile.is_verified;
      response.verificationDate = user.expertProfile.verification_date;
    }

    return response;
  }

  /**
   * 사용자 정보 수정
   */
  async updateUser(userId: number, updateData: any, adminId: number): Promise<any> {
    console.log(`🔍 UpdateUser - userId: ${userId}, updateData:`, JSON.stringify(updateData, null, 2));
    
    // 트랜잭션 사용하여 데이터 일관성 보장
    return await this.dataSource.transaction(async manager => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        relations: ['expertProfile']
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      console.log(`🔍 Found user - type: ${user.user_type}, has expertProfile: ${!!user.expertProfile}`);

      // 관리자 권한 확인 로직 (필요시 추가)
      // TODO: 관리자 레벨에 따른 수정 권한 체크

      // 1. 기본 사용자 정보 업데이트
      const allowedUserFields = ['name', 'email', 'phone', 'user_type', 'center_id', 'supervisor_id', 'status'];
      const userUpdateFields: any = {};
      
      for (const field of allowedUserFields) {
        if (updateData[field] !== undefined) {
          userUpdateFields[field] = updateData[field];
        }
      }

      // null 값 처리
      if (userUpdateFields.center_id === null || userUpdateFields.center_id === undefined) {
        userUpdateFields.center_id = null;
      }
      if (userUpdateFields.supervisor_id === null || userUpdateFields.supervisor_id === undefined) {
        userUpdateFields.supervisor_id = null;
      }
      if (userUpdateFields.phone === null || userUpdateFields.phone === undefined || userUpdateFields.phone === '') {
        userUpdateFields.phone = null;
      }

      // 사용자 정보 업데이트
      if (Object.keys(userUpdateFields).length > 0) {
        await manager.update(User, userId, userUpdateFields);
      }

      // 2. 전문가 프로필 정보 업데이트 (전문가인 경우)
      if (user.user_type === UserType.EXPERT || updateData.user_type === UserType.EXPERT) {
        console.log(`🔍 Processing expert profile update...`);
        
        const expertProfileFields = {
          introduction: updateData.bio,
          specialization: updateData.specialties || [],
          years_experience: updateData.years_experience ? Number(updateData.years_experience) : undefined,
          hourly_rate: updateData.hourly_rate ? Number(updateData.hourly_rate) : undefined,
          license_type: updateData.license_type,
          license_number: updateData.license_number,
          center_id: updateData.center_id
        };

        console.log(`🔍 Expert profile fields before cleaning:`, expertProfileFields);

        // undefined 값과 빈 문자열 제거 (단, 배열은 유지)
        const cleanedExpertFields = Object.fromEntries(
          Object.entries(expertProfileFields).filter(([key, value]) => {
            if (value === undefined) return false;
            if (key === 'specialization') return true; // 배열은 항상 유지
            if (typeof value === 'string' && value.trim() === '') return false;
            return true;
          })
        );

        console.log(`🔍 Cleaned expert fields:`, cleanedExpertFields);

        if (Object.keys(cleanedExpertFields).length > 0) {
          // 기존 ExpertProfile 확인
          let expertProfile = await manager.findOne(ExpertProfile, {
            where: { user_id: userId }
          });

          console.log(`🔍 Existing expert profile found: ${!!expertProfile}`);

          if (expertProfile) {
            // 기존 프로필 업데이트
            console.log(`🔍 Updating existing profile with ID: ${expertProfile.id}`);
            await manager.update(ExpertProfile, expertProfile.id, cleanedExpertFields);
            console.log(`✅ Expert profile updated successfully`);
          } else {
            // 새 프로필 생성
            console.log(`🔍 Creating new expert profile`);
            expertProfile = manager.create(ExpertProfile, {
              user_id: userId,
              ...cleanedExpertFields
            });
            await manager.save(ExpertProfile, expertProfile);
            console.log(`✅ New expert profile created successfully`);
          }
        } else {
          console.log(`⚠️ No expert fields to update (all undefined)`);
        }
      }

      // 업데이트된 사용자 정보 반환
      return await this.getUserById(userId);
    });
  }

  /**
   * 전문가 종합 정보 수정 (사용자 기본 정보 + 전문가 프로필 정보)
   */
  async updateExpertComprehensive(
    userId: number, 
    updateData: UpdateExpertComprehensiveDto, 
    adminId: number
  ): Promise<UpdateExpertComprehensiveResponseDto> {
    console.log(`🔍 UpdateExpertComprehensive - userId: ${userId}, updateData:`, JSON.stringify(updateData, null, 2));
    
    // 트랜잭션 사용하여 데이터 일관성 보장
    return await this.dataSource.transaction(async manager => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        relations: ['expertProfile']
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      if (user.user_type !== UserType.EXPERT) {
        throw new BadRequestException('전문가 계정이 아닙니다.');
      }

      console.log(`🔍 Found expert user - name: ${user.name}, has expertProfile: ${!!user.expertProfile}`);

      const updatedUserFields: string[] = [];
      const updatedExpertFields: string[] = [];

      // 1. 기본 사용자 정보 업데이트
      const userUpdateFields: any = {};
      
      if (updateData.name !== undefined) {
        userUpdateFields.name = updateData.name;
        updatedUserFields.push('name');
      }
      
      if (updateData.phone !== undefined) {
        userUpdateFields.phone = updateData.phone || null;
        updatedUserFields.push('phone');
      }
      
      if (updateData.status !== undefined) {
        userUpdateFields.status = updateData.status;
        updatedUserFields.push('status');
      }
      
      if (updateData.center_id !== undefined) {
        userUpdateFields.center_id = updateData.center_id || null;
        updatedUserFields.push('center_id');
      }

      // 사용자 정보 업데이트
      if (Object.keys(userUpdateFields).length > 0) {
        console.log(`🔍 Updating user fields:`, userUpdateFields);
        await manager.update(User, userId, userUpdateFields);
      }

      // 2. 전문가 프로필 정보 업데이트
      const expertProfileFields: any = {};
      
      if (updateData.license_number !== undefined) {
        expertProfileFields.license_number = updateData.license_number;
        updatedExpertFields.push('license_number');
      }
      
      if (updateData.license_type !== undefined) {
        expertProfileFields.license_type = updateData.license_type;
        updatedExpertFields.push('license_type');
      }
      
      if (updateData.years_experience !== undefined) {
        expertProfileFields.years_experience = updateData.years_experience;
        updatedExpertFields.push('years_experience');
      }
      
      if (updateData.hourly_rate !== undefined) {
        expertProfileFields.hourly_rate = updateData.hourly_rate;
        updatedExpertFields.push('hourly_rate');
      }
      
      if (updateData.specialization !== undefined) {
        expertProfileFields.specialization = updateData.specialization || [];
        updatedExpertFields.push('specialization');
      }
      
      if (updateData.introduction !== undefined) {
        expertProfileFields.introduction = updateData.introduction;
        updatedExpertFields.push('introduction');
      }
      
      if (updateData.education !== undefined) {
        expertProfileFields.education = updateData.education;
        updatedExpertFields.push('education');
      }
      
      if (updateData.career_history !== undefined) {
        expertProfileFields.career_history = updateData.career_history;
        updatedExpertFields.push('career_history');
      }

      if (updateData.center_id !== undefined) {
        expertProfileFields.center_id = updateData.center_id || null;
        if (!updatedExpertFields.includes('center_id')) {
          updatedExpertFields.push('center_id');
        }
      }

      // 전문가 프로필 업데이트
      if (Object.keys(expertProfileFields).length > 0) {
        console.log(`🔍 Expert profile fields to update:`, expertProfileFields);

        // 기존 ExpertProfile 확인
        let expertProfile = await manager.findOne(ExpertProfile, {
          where: { user_id: userId }
        });

        console.log(`🔍 Existing expert profile found: ${!!expertProfile}`);

        if (expertProfile) {
          // 기존 프로필 업데이트
          console.log(`🔍 Updating existing profile with ID: ${expertProfile.id}`);
          await manager.update(ExpertProfile, expertProfile.id, expertProfileFields);
          console.log(`✅ Expert profile updated successfully`);
        } else {
          // 새 프로필 생성
          console.log(`🔍 Creating new expert profile`);
          expertProfile = manager.create(ExpertProfile, {
            user_id: userId,
            ...expertProfileFields,
            // 기본값 설정
            specialization: expertProfileFields.specialization || [],
            years_experience: expertProfileFields.years_experience || 0,
            hourly_rate: expertProfileFields.hourly_rate || 0,
            is_verified: false
          });
          await manager.save(ExpertProfile, expertProfile);
          console.log(`✅ New expert profile created successfully`);
        }
      } else {
        console.log(`⚠️ No expert fields to update`);
      }

      // 업데이트된 사용자 정보 조회
      const updatedUser = await manager.findOne(User, {
        where: { id: userId },
        relations: ['expertProfile']
      });

      return {
        message: '전문가 정보가 성공적으로 업데이트되었습니다.',
        expert_id: userId,
        expert_name: updatedUser.name,
        updated_fields: {
          user_fields: updatedUserFields,
          expert_fields: updatedExpertFields
        },
        updated_at: new Date()
      };
    });
  }

  async getAllSchedules(centerId?: number): Promise<{
    schedules: any[];
    totalSchedules: number;
    availableSchedules: number;
    bookedSchedules: number;
    completedSchedules: number;
    cancelledSchedules: number;
  }> {
    const queryBuilder = this.schedulesRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.expert', 'expert')
      .leftJoinAndSelect('expert.center', 'center')
      .leftJoin('counselings', 'counseling', 'counseling.schedule_id = schedule.id')
      .leftJoinAndSelect('counseling.user', 'client');

    // 센터별 필터링
    if (centerId) {
      queryBuilder.where('expert.center_id = :centerId', { centerId });
    }

    const rawResults = await queryBuilder
      .addSelect('client.id', 'client_id')
      .addSelect('client.name', 'client_name')
      .orderBy('schedule.schedule_date', 'DESC')
      .addOrderBy('schedule.start_time', 'ASC')
      .getRawAndEntities();

    const allSchedules = rawResults.entities;
    const rawData = rawResults.raw;

    // 통계 계산
    const totalSchedules = allSchedules.length;
    const availableSchedules = allSchedules.filter(s => s.status === ScheduleStatus.AVAILABLE).length;
    const bookedSchedules = allSchedules.filter(s => s.status === ScheduleStatus.BOOKED).length;
    const completedSchedules = allSchedules.filter(s => s.status === ScheduleStatus.COMPLETED).length;
    const cancelledSchedules = allSchedules.filter(s => s.status === ScheduleStatus.CANCELLED).length;

    // 응답 데이터 변환 with client info from raw data
    const schedules = allSchedules.map((schedule, index) => {
      const raw = rawData[index];
      return {
        id: schedule.id,
        title: schedule.title || '상담 일정',
        schedule_date: schedule.schedule_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status: schedule.status,
        notes: schedule.notes,
        expert: {
          id: schedule.expert?.id,
          name: schedule.expert?.name,
          center: schedule.expert?.center ? {
            id: schedule.expert.center.id,
            name: schedule.expert.center.name
          } : null
        },
        client: raw?.client_id ? {
          id: raw.client_id,
          name: raw.client_name
        } : null,
        created_at: schedule.created_at,
        updated_at: schedule.updated_at
      };
    });

    return {
      schedules,
      totalSchedules,
      availableSchedules,
      bookedSchedules,
      completedSchedules,
      cancelledSchedules
    };
  }

  async cancelSchedule(scheduleId: number, adminId: number): Promise<{ success: boolean; message: string }> {
    const schedule = await this.schedulesRepository.findOne({
      where: { id: scheduleId },
      relations: ['expert']
    });

    if (!schedule) {
      throw new NotFoundException('일정을 찾을 수 없습니다.');
    }

    if (schedule.status === ScheduleStatus.CANCELLED) {
      throw new BadRequestException('이미 취소된 일정입니다.');
    }

    if (schedule.status === ScheduleStatus.COMPLETED) {
      throw new BadRequestException('완료된 일정은 취소할 수 없습니다.');
    }

    // 일정 취소 처리
    schedule.status = ScheduleStatus.CANCELLED;
    schedule.notes = `${schedule.notes ? schedule.notes + ' | ' : ''}관리자에 의해 취소됨`;
    await this.schedulesRepository.save(schedule);

    // 관련 상담이 있는 경우 상담도 취소 처리
    const relatedCounseling = await this.counselingRepository.findOne({
      where: { schedule_id: scheduleId }
    });
    
    if (relatedCounseling) {
      relatedCounseling.status = CounselingStatus.CANCELLED;
      await this.counselingRepository.save(relatedCounseling);
    }

    LoggerUtil.info('관리자에 의한 일정 취소 처리', { scheduleId, expertId: schedule.expert_id });

    return {
      success: true,
      message: '일정이 성공적으로 취소되었습니다.'
    };
  }

  async getExpertWorkingHours(expertId: number, startDate: string, endDate: string): Promise<any[]> {
    // 전문가 존재 확인
    const expert = await this.userRepository.findOne({
      where: { id: expertId, user_type: UserType.EXPERT }
    });

    if (!expert) {
      throw new NotFoundException('전문가를 찾을 수 없습니다.');
    }

    // 날짜 범위 내의 스케줄 조회
    const schedules = await this.schedulesRepository
      .createQueryBuilder('schedule')
      .where('schedule.expert_id = :expertId', { expertId })
      .andWhere('schedule.schedule_date >= :startDate', { startDate })
      .andWhere('schedule.schedule_date <= :endDate', { endDate })
      .orderBy('schedule.schedule_date', 'ASC')
      .addOrderBy('schedule.start_time', 'ASC')
      .getMany();

    // 날짜별로 그룹화하여 근무시간 계산
    const workingHoursMap = new Map<string, any>();

    schedules.forEach(schedule => {
      const dateKey = schedule.schedule_date.toISOString().split('T')[0];
      
      if (!workingHoursMap.has(dateKey)) {
        workingHoursMap.set(dateKey, {
          expertId,
          date: dateKey,
          schedules: [],
          totalMinutes: 0
        });
      }

      const dayData = workingHoursMap.get(dateKey);
      dayData.schedules.push({
        id: schedule.id,
        title: schedule.title,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        status: schedule.status
      });

      // 근무시간 계산 (분 단위)
      const startTime = new Date(`2000-01-01T${schedule.start_time}`);
      const endTime = new Date(`2000-01-01T${schedule.end_time}`);
      const diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      dayData.totalMinutes += diffMinutes;
    });

    // Map을 배열로 변환하고 근무시간 정보 추가
    const workingHours = Array.from(workingHoursMap.values()).map(dayData => {
      const totalHours = Math.round((dayData.totalMinutes / 60) * 100) / 100; // 소수점 2자리
      const firstSchedule = dayData.schedules[0];
      const lastSchedule = dayData.schedules[dayData.schedules.length - 1];

      return {
        expertId: dayData.expertId,
        date: dayData.date,
        startTime: firstSchedule?.startTime || null,
        endTime: lastSchedule?.endTime || null,
        totalHours,
        totalMinutes: dayData.totalMinutes,
        scheduleCount: dayData.schedules.length,
        schedules: dayData.schedules,
        breakTime: 0 // 휴게시간은 현재 구현하지 않음
      };
    });

    return workingHours;
  }

  // 전체 전문가 목록 조회 (모든 센터)
  async getAllExperts(): Promise<any[]> {
    const experts = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.center', 'center')
      .leftJoinAndSelect('user.expertProfile', 'profile')
      .where('user.user_type = :userType', { userType: UserType.EXPERT })
      .andWhere('user.status IN (:...statuses)', { statuses: [UserStatus.ACTIVE, UserStatus.PENDING] })
      .orderBy('user.name', 'ASC')
      .getMany();

    return experts.map(expert => ({
      id: expert.id,
      name: expert.name,
      email: expert.email,
      specialties: expert.expertProfile?.specialization || [],
      status: expert.status,
      center_id: expert.center_id,
      centerName: expert.center?.name || null,
      createdAt: expert.created_at?.toISOString()
    }));
  }

  // 설문 테스트 목록 조회 (관리자용)
  async getAllPsychTests(): Promise<any[]> {
    const tests = await this.psychTestRepository
      .createQueryBuilder('test')
      .leftJoin('test.questions', 'question')
      .addSelect('COUNT(question.id)', 'questions_count')
      .groupBy('test.id')
      .orderBy('test.created_at', 'DESC')
      .getRawAndEntities();

    return tests.entities.map((test, index) => ({
      id: test.id,
      title: test.title,
      description: test.description,
      logic_type: test.logic_type,
      is_active: test.is_active,
      max_score: test.max_score,
      estimated_time: test.estimated_time,
      instruction: test.instruction,
      questions_count: parseInt(tests.raw[index].questions_count) || 0,
      created_at: test.created_at,
      updated_at: test.updated_at
    }));
  }

  // 설문 테스트 생성 (관리자용)
  async createPsychTest(testData: any): Promise<any> {
    try {
      LoggerUtil.info('설문 테스트 생성 요청', testData);

      const newTest = this.psychTestRepository.create({
        title: testData.title,
        description: testData.description,
        logic_type: testData.logic_type,
        is_active: testData.is_active !== false, // 기본값 true
        max_score: testData.max_score || null,
        estimated_time: testData.estimated_time,
        instruction: testData.instruction || null,
        scoring_rules: testData.scoring_rules || null,
        result_ranges: testData.result_ranges || null,
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedTest = await this.psychTestRepository.save(newTest);

      LoggerUtil.info('설문 테스트 생성 성공', { testId: savedTest.id });

      return {
        id: savedTest.id,
        title: savedTest.title,
        description: savedTest.description,
        logic_type: savedTest.logic_type,
        is_active: savedTest.is_active,
        max_score: savedTest.max_score,
        estimated_time: savedTest.estimated_time,
        instruction: savedTest.instruction,
        scoring_rules: savedTest.scoring_rules,
        result_ranges: savedTest.result_ranges,
        questions_count: 0,
        created_at: savedTest.created_at,
        updated_at: savedTest.updated_at
      };
    } catch (error) {
      LoggerUtil.error('설문 테스트 생성 실패', error);
      throw new ConflictException('설문 테스트 생성에 실패했습니다.');
    }
  }

  // 설문 테스트 상세 조회 (관리자용)
  async getPsychTestById(testId: number): Promise<any> {
    const test = await this.psychTestRepository.findOne({
      where: { id: testId },
      relations: ['questions']
    });

    if (!test) {
      throw new NotFoundException('설문 테스트를 찾을 수 없습니다.');
    }

    // 문항을 순서대로 정렬
    test.questions.sort((a, b) => a.question_order - b.question_order);

    return {
      id: test.id,
      title: test.title,
      description: test.description,
      logic_type: test.logic_type,
      is_active: test.is_active,
      max_score: test.max_score,
      estimated_time: test.estimated_time,
      instruction: test.instruction,
      scoring_rules: test.scoring_rules,
      result_ranges: test.result_ranges,
      questions: test.questions.map(q => ({
        id: q.id,
        question: q.question,
        question_order: q.question_order,
        question_type: q.question_type,
        options: q.options,
        is_required: q.is_required,
        help_text: q.help_text,
        created_at: q.created_at
      })),
      created_at: test.created_at,
      updated_at: test.updated_at
    };
  }

  // ======================
  // 분기 로직 관리 메서드들
  // ======================
  
  // 분기 로직 목록 조회
  async getAllLogicRules(testId?: number): Promise<any[]> {
    const queryBuilder = this.logicRuleRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.test', 'test')
      .leftJoinAndSelect('rule.source_question', 'source');

    if (testId) {
      queryBuilder.where('rule.test_id = :testId', { testId });
    }

    const rules = await queryBuilder
      .orderBy('rule.priority', 'ASC')
      .addOrderBy('rule.created_at', 'DESC')
      .getMany();

    return rules.map(rule => ({
      id: rule.id,
      testId: rule.test_id,
      name: rule.name,
      description: rule.description,
      sourceQuestionId: rule.source_question_id,
      condition: rule.condition,
      action: rule.action,
      priority: rule.priority,
      isActive: rule.is_active,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at
    }));
  }

  // 분기 로직 상세 조회
  async getLogicRuleById(ruleId: number): Promise<any> {
    const rule = await this.logicRuleRepository.findOne({
      where: { id: ruleId },
      relations: ['test', 'source_question']
    });

    if (!rule) {
      throw new NotFoundException('분기 로직을 찾을 수 없습니다.');
    }

    return {
      id: rule.id,
      testId: rule.test_id,
      name: rule.name,
      description: rule.description,
      sourceQuestionId: rule.source_question_id,
      condition: rule.condition,
      action: rule.action,
      priority: rule.priority,
      isActive: rule.is_active,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at
    };
  }

  // 분기 로직 생성
  async createLogicRule(ruleData: any): Promise<any> {
    try {
      LoggerUtil.info('분기 로직 생성 요청', ruleData);

      // 테스트 존재 확인 (snake_case로 변환된 데이터 사용)
      const test = await this.psychTestRepository.findOne({
        where: { id: ruleData.test_id }
      });

      if (!test) {
        throw new NotFoundException('설문 테스트를 찾을 수 없습니다.');
      }

      // 소스 문항 존재 확인 (snake_case로 변환된 데이터 사용)
      const sourceQuestion = await this.psychQuestionRepository.findOne({
        where: { id: ruleData.source_question_id, test_id: ruleData.test_id }
      });

      if (!sourceQuestion) {
        throw new NotFoundException('소스 문항을 찾을 수 없습니다.');
      }

      // 디버깅용 로그 추가
      LoggerUtil.info('분기 로직 생성 데이터 확인', {
        test_id: ruleData.test_id,
        source_question_id: ruleData.source_question_id,
        ruleData: ruleData
      });

      const newRule = this.logicRuleRepository.create({
        test_id: ruleData.test_id,
        name: ruleData.name,
        description: ruleData.description,
        source_question_id: ruleData.source_question_id,
        condition: ruleData.condition,
        action: ruleData.action,
        priority: ruleData.priority || 1,
        is_active: ruleData.is_active !== false
      });

      // 생성된 엔티티 확인 로그
      LoggerUtil.info('생성된 엔티티 확인', {
        test_id: newRule.test_id,
        source_question_id: newRule.source_question_id,
        entity: newRule
      });

      const savedRule = await this.logicRuleRepository.save(newRule);

      LoggerUtil.info('분기 로직 생성 성공', { ruleId: savedRule.id });

      return {
        id: savedRule.id,
        testId: savedRule.test_id,
        name: savedRule.name,
        description: savedRule.description,
        sourceQuestionId: savedRule.source_question_id,
        condition: savedRule.condition,
        action: savedRule.action,
        priority: savedRule.priority,
        isActive: savedRule.is_active,
        createdAt: savedRule.created_at,
        updatedAt: savedRule.updated_at
      };
    } catch (error) {
      LoggerUtil.error('분기 로직 생성 실패', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException('분기 로직 생성에 실패했습니다.');
    }
  }

  // 분기 로직 수정
  async updateLogicRule(ruleId: number, ruleData: any): Promise<any> {
    try {
      LoggerUtil.info('분기 로직 수정 요청', { ruleId, ...ruleData });

      const rule = await this.logicRuleRepository.findOne({
        where: { id: ruleId }
      });

      if (!rule) {
        throw new NotFoundException('분기 로직을 찾을 수 없습니다.');
      }

      // 소스 문항 존재 확인 (변경하는 경우)
      if (ruleData.source_question_id && ruleData.source_question_id !== rule.source_question_id) {
        const sourceQuestion = await this.psychQuestionRepository.findOne({
          where: { id: ruleData.source_question_id, test_id: rule.test_id }
        });

        if (!sourceQuestion) {
          throw new NotFoundException('소스 문항을 찾을 수 없습니다.');
        }
      }

      // 업데이트할 필드들 설정
      if (ruleData.name !== undefined) rule.name = ruleData.name;
      if (ruleData.description !== undefined) rule.description = ruleData.description;
      if (ruleData.source_question_id !== undefined) rule.source_question_id = ruleData.source_question_id;
      if (ruleData.condition !== undefined) rule.condition = ruleData.condition;
      if (ruleData.action !== undefined) rule.action = ruleData.action;
      if (ruleData.priority !== undefined) rule.priority = ruleData.priority;
      if (ruleData.is_active !== undefined) rule.is_active = ruleData.is_active;
      rule.updated_at = new Date();

      const updatedRule = await this.logicRuleRepository.save(rule);

      LoggerUtil.info('분기 로직 수정 성공', { ruleId });

      return {
        id: updatedRule.id,
        testId: updatedRule.test_id,
        name: updatedRule.name,
        description: updatedRule.description,
        sourceQuestionId: updatedRule.source_question_id,
        condition: updatedRule.condition,
        action: updatedRule.action,
        priority: updatedRule.priority,
        isActive: updatedRule.is_active,
        createdAt: updatedRule.created_at,
        updatedAt: updatedRule.updated_at
      };
    } catch (error) {
      LoggerUtil.error('분기 로직 수정 실패', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException('분기 로직 수정에 실패했습니다.');
    }
  }

  // 분기 로직 삭제
  async deleteLogicRule(ruleId: number): Promise<{ success: boolean; message: string }> {
    try {
      LoggerUtil.info('분기 로직 삭제 요청', { ruleId });

      const rule = await this.logicRuleRepository.findOne({
        where: { id: ruleId }
      });

      if (!rule) {
        throw new NotFoundException('분기 로직을 찾을 수 없습니다.');
      }

      await this.logicRuleRepository.remove(rule);

      LoggerUtil.info('분기 로직 삭제 성공', { ruleId });

      return {
        success: true,
        message: '분기 로직이 성공적으로 삭제되었습니다.'
      };
    } catch (error) {
      LoggerUtil.error('분기 로직 삭제 실패', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException('분기 로직 삭제에 실패했습니다.');
    }
  }

  // 분기 로직 활성/비활성 토글
  async toggleLogicRuleStatus(ruleId: number): Promise<any> {
    try {
      LoggerUtil.info('분기 로직 상태 토글 요청', { ruleId });

      const rule = await this.logicRuleRepository.findOne({
        where: { id: ruleId }
      });

      if (!rule) {
        throw new NotFoundException('분기 로직을 찾을 수 없습니다.');
      }

      const beforeStatus = rule.is_active;
      rule.is_active = !rule.is_active;
      rule.updated_at = new Date();

      const updatedRule = await this.logicRuleRepository.save(rule);

      LoggerUtil.info('분기 로직 상태 토글 성공', { 
        ruleId, 
        beforeStatus,
        afterStatus: updatedRule.is_active,
        toggledCorrectly: beforeStatus !== updatedRule.is_active
      });

      return {
        id: updatedRule.id,
        testId: updatedRule.test_id,
        name: updatedRule.name,
        description: updatedRule.description,
        sourceQuestionId: updatedRule.source_question_id,
        condition: updatedRule.condition,
        action: updatedRule.action,
        priority: updatedRule.priority,
        isActive: updatedRule.is_active,
        createdAt: updatedRule.created_at,
        updatedAt: updatedRule.updated_at
      };
    } catch (error) {
      LoggerUtil.error('분기 로직 상태 토글 실패', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException('분기 로직 상태 변경에 실패했습니다.');
    }
  }

  // ======================
  // 결제 관리 메서드들
  // ======================

  // 결제 내역 조회
  async getAllPayments(params: {
    status?: string;
    serviceType?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<any> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .leftJoinAndSelect('payment.expert', 'expert')
      .leftJoinAndSelect('expert.user', 'expertUser')
      .leftJoinAndSelect('payment.counseling', 'counseling');

    // 필터 적용
    if (params.status && params.status !== 'all') {
      queryBuilder.andWhere('payment.status = :status', { status: params.status });
    }

    if (params.serviceType && params.serviceType !== 'all') {
      queryBuilder.andWhere('payment.service_type = :serviceType', { serviceType: params.serviceType });
    }

    if (params.paymentMethod && params.paymentMethod !== 'all') {
      queryBuilder.andWhere('payment.payment_method = :paymentMethod', { paymentMethod: params.paymentMethod });
    }

    if (params.startDate) {
      queryBuilder.andWhere('payment.paid_at >= :startDate', { startDate: `${params.startDate} 00:00:00` });
    }

    if (params.endDate) {
      queryBuilder.andWhere('payment.paid_at <= :endDate', { endDate: `${params.endDate} 23:59:59` });
    }

    if (params.search) {
      queryBuilder.andWhere('(user.name LIKE :search OR expertUser.name LIKE :search OR payment.transaction_id LIKE :search OR payment.service_name LIKE :search)', 
        { search: `%${params.search}%` });
    }

    // 페이지네이션
    const offset = (params.page - 1) * params.limit;
    queryBuilder
      .orderBy('payment.paid_at', 'DESC')
      .skip(offset)
      .take(params.limit);

    const [payments, total] = await queryBuilder.getManyAndCount();

    return {
      data: payments.map(payment => ({
        id: payment.id,
        transactionId: payment.transaction_id,
        userId: payment.user_id,
        userName: payment.user?.name || '알 수 없음',
        userEmail: payment.user?.email || '',
        expertId: payment.expert_id,
        expertName: payment.expert?.user?.name || '알 수 없음',
        serviceType: payment.service_type,
        serviceName: payment.service_name,
        amount: payment.amount,
        fee: payment.fee,
        netAmount: payment.net_amount,
        paymentMethod: payment.payment_method,
        paymentProvider: payment.payment_provider,
        status: payment.status,
        paidAt: payment.paid_at ? payment.paid_at.toISOString() : null,
        refundedAt: payment.refunded_at ? payment.refunded_at.toISOString() : null,
        refundReason: payment.refund_reason,
        sessionDuration: payment.session_duration,
        notes: payment.notes,
        receiptUrl: payment.receipt_url,
        createdAt: payment.created_at ? payment.created_at.toISOString() : null,
        updatedAt: payment.updated_at ? payment.updated_at.toISOString() : null
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit)
      }
    };
  }


  // 결제 상세 조회
  async getPaymentById(paymentId: number): Promise<any> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['user', 'expert', 'expert.user', 'counseling']
    });

    if (!payment) {
      throw new NotFoundException('결제를 찾을 수 없습니다.');
    }

    return {
      id: payment.id,
      transactionId: payment.transaction_id,
      userId: payment.user_id,
      userName: payment.user?.name || '알 수 없음',
      userEmail: payment.user?.email || '',
      expertId: payment.expert_id,
      expertName: payment.expert?.user?.name || '알 수 없음',
      serviceType: payment.service_type,
      serviceName: payment.service_name,
      amount: payment.amount,
      fee: payment.fee,
      netAmount: payment.net_amount,
      paymentMethod: payment.payment_method,
      paymentProvider: payment.payment_provider,
      status: payment.status,
      paidAt: payment.paid_at,
      refundedAt: payment.refunded_at,
      refundReason: payment.refund_reason,
      sessionDuration: payment.session_duration,
      notes: payment.notes,
      receiptUrl: payment.receipt_url,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at
    };
  }

  // 결제 환불 처리
  async refundPayment(paymentId: number, reason: string): Promise<any> {
    try {
      LoggerUtil.info('결제 환불 처리 요청', { paymentId, reason });

      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['user', 'expert', 'expert.user']
      });

      if (!payment) {
        throw new NotFoundException('결제를 찾을 수 없습니다.');
      }

      if (payment.status !== 'completed') {
        throw new BadRequestException('완료된 결제만 환불 처리할 수 있습니다.');
      }

      // 환불 처리
      payment.status = 'refunded';
      payment.refunded_at = new Date();
      payment.refund_reason = reason;
      payment.updated_at = new Date();

      const updatedPayment = await this.paymentRepository.save(payment);

      LoggerUtil.info('결제 환불 처리 성공', { paymentId });

      return {
        id: updatedPayment.id,
        transactionId: updatedPayment.transaction_id,
        status: updatedPayment.status,
        refundedAt: updatedPayment.refunded_at,
        refundReason: updatedPayment.refund_reason,
        amount: updatedPayment.amount
      };
    } catch (error) {
      LoggerUtil.error('결제 환불 처리 실패', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new ConflictException('결제 환불 처리에 실패했습니다.');
    }
  }

  // ======================
  // 결제 통계 관리 메서드들
  // ======================

  // 결제 통계 조회
  async getPaymentStats(startDate?: string, endDate?: string): Promise<any> {
    try {
      LoggerUtil.info('결제 통계 조회 시작', { startDate, endDate });
      const queryBuilder = this.paymentRepository
        .createQueryBuilder('payment')
        .select([
          'COUNT(*) as totalTransactions',
          'COALESCE(SUM(payment.amount), 0) as totalAmount',
          'COALESCE(SUM(payment.fee), 0) as totalFee',
          'COALESCE(SUM(payment.net_amount), 0) as totalNet',
          'COALESCE(SUM(CASE WHEN payment.status = \'refunded\' THEN payment.amount ELSE 0 END), 0) as refundedAmount',
          'COUNT(CASE WHEN payment.status = \'completed\' THEN 1 END) as completedCount',
          'COUNT(CASE WHEN payment.status = \'pending\' THEN 1 END) as pendingCount',
          'COUNT(CASE WHEN payment.status = \'failed\' THEN 1 END) as failedCount',
          'COUNT(CASE WHEN payment.status = \'refunded\' THEN 1 END) as refundedCount',
          'COUNT(CASE WHEN payment.status = \'cancelled\' THEN 1 END) as cancelledCount',
          'COUNT(CASE WHEN payment.service_type = \'video\' THEN 1 END) as videoCount',
          'COUNT(CASE WHEN payment.service_type = \'chat\' THEN 1 END) as chatCount',
          'COUNT(CASE WHEN payment.service_type = \'voice\' THEN 1 END) as voiceCount',
          'COUNT(CASE WHEN payment.service_type = \'test\' THEN 1 END) as testCount',
        ]);

      // 테스트를 위해 날짜 조건 임시 제거
      // if (startDate) {
      //   queryBuilder.andWhere('payment.paid_at >= :startDate', { startDate: `${startDate} 00:00:00` });
      // }

      // if (endDate) {
      //   queryBuilder.andWhere('payment.paid_at <= :endDate', { endDate: `${endDate} 23:59:59` });
      // }

      const result = await queryBuilder.getRawOne();
      LoggerUtil.info('결제 통계 쿼리 결과', result);

      return {
        totalTransactions: parseInt(result.totalTransactions) || 0,
        totalAmount: parseFloat(result.totalAmount) || 0,
        totalFee: parseFloat(result.totalFee) || 0,
        totalNet: parseFloat(result.totalNet) || 0,
        refundedAmount: parseFloat(result.refundedAmount) || 0,
        statusCounts: {
          completed: parseInt(result.completedCount) || 0,
          pending: parseInt(result.pendingCount) || 0,
          failed: parseInt(result.failedCount) || 0,
          refunded: parseInt(result.refundedCount) || 0,
          cancelled: parseInt(result.cancelledCount) || 0
        },
        serviceStats: {
          video: parseInt(result.videoCount) || 0,
          chat: parseInt(result.chatCount) || 0,
          voice: parseInt(result.voiceCount) || 0,
          test: parseInt(result.testCount) || 0,
        },
        averageAmount: parseInt(result.totalTransactions) > 0 ? 
          parseFloat(result.totalAmount) / parseInt(result.totalTransactions) : 0,
        feePercentage: parseFloat(result.totalAmount) > 0 ? 
          (parseFloat(result.totalFee) / parseFloat(result.totalAmount)) * 100 : 0
      };
    } catch (error) {
      LoggerUtil.error('결제 통계 조회 실패', error);
      throw error;
    }
  }

  // ======================
  // 매출 통계 관리 메서드들
  // ======================

  // 매출 통계 조회
  async getRevenueStats(periodType: string = 'monthly', startDate?: string, endDate?: string): Promise<any> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: 'completed' });

    if (startDate) {
      queryBuilder.andWhere('payment.paid_at >= :startDate', { startDate: `${startDate} 00:00:00` });
    }

    if (endDate) {
      queryBuilder.andWhere('payment.paid_at <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const payments = await queryBuilder.getMany();

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const platformFee = payments.reduce((sum, p) => sum + p.fee, 0);
    const expertRevenue = payments.reduce((sum, p) => sum + p.net_amount, 0);
    const transactionCount = payments.length;
    const averageTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    // 서비스별 분류
    const serviceBreakdown = {
      video: { count: 0, revenue: 0 },
      chat: { count: 0, revenue: 0 },
      voice: { count: 0, revenue: 0 },
      test: { count: 0, revenue: 0 }
    };

    payments.forEach(payment => {
      if (serviceBreakdown[payment.service_type]) {
        serviceBreakdown[payment.service_type].count += 1;
        serviceBreakdown[payment.service_type].revenue += payment.amount;
      }
    });

    // 환불 금액 조회
    const refundQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: 'refunded' });

    if (startDate) {
      refundQuery.andWhere('payment.paid_at >= :startDate', { startDate: `${startDate} 00:00:00` });
    }

    if (endDate) {
      refundQuery.andWhere('payment.paid_at <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const refundedPayments = await refundQuery.getMany();
    const refundAmount = refundedPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalRevenue,
      platformFee,
      expertRevenue,
      transactionCount,
      averageTransaction,
      serviceBreakdown,
      refundAmount,
      averageMonthlyRevenue: totalRevenue, // 단일 기간이므로 동일값
      feePercentage: totalRevenue > 0 ? (platformFee / totalRevenue) * 100 : 0
    };
  }

  // 매출 트렌드 조회 (기간별)
  async getRevenueTrends(periodType: string = 'monthly', startDate?: string, endDate?: string): Promise<any> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: 'completed' });

    if (startDate) {
      queryBuilder.andWhere('payment.paid_at >= :startDate', { startDate: `${startDate} 00:00:00` });
    }

    if (endDate) {
      queryBuilder.andWhere('payment.paid_at <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const payments = await queryBuilder
      .orderBy('payment.paid_at', 'ASC')
      .getMany();

    // 기간별 그룹핑
    const groupedData: { [key: string]: any } = {};

    payments.forEach(payment => {
      let periodKey: string;
      const date = new Date(payment.paid_at);

      switch (periodType) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          periodKey = String(date.getFullYear());
          break;
        default:
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groupedData[periodKey]) {
        groupedData[periodKey] = {
          period: periodKey,
          totalRevenue: 0,
          platformFee: 0,
          expertRevenue: 0,
          transactionCount: 0,
          serviceBreakdown: {
            video: { count: 0, revenue: 0 },
            chat: { count: 0, revenue: 0 },
            voice: { count: 0, revenue: 0 },
            test: { count: 0, revenue: 0 }
          },
          refundAmount: 0
        };
      }

      const periodData = groupedData[periodKey];
      periodData.totalRevenue += payment.amount;
      periodData.platformFee += payment.fee;
      periodData.expertRevenue += payment.net_amount;
      periodData.transactionCount += 1;

      if (periodData.serviceBreakdown[payment.service_type]) {
        periodData.serviceBreakdown[payment.service_type].count += 1;
        periodData.serviceBreakdown[payment.service_type].revenue += payment.amount;
      }
    });

    // 환불 데이터도 포함
    const refundQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: 'refunded' });

    if (startDate) {
      refundQuery.andWhere('payment.paid_at >= :startDate', { startDate: `${startDate} 00:00:00` });
    }

    if (endDate) {
      refundQuery.andWhere('payment.paid_at <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const refundedPayments = await refundQuery.getMany();

    refundedPayments.forEach(payment => {
      let periodKey: string;
      const date = new Date(payment.paid_at);

      switch (periodType) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          periodKey = String(date.getFullYear());
          break;
        default:
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (groupedData[periodKey]) {
        groupedData[periodKey].refundAmount += payment.amount;
      }
    });

    // 배열로 변환하고 성장률 계산
    const trendData = Object.values(groupedData).map((data: any, index, array) => {
      const previousData = index > 0 ? array[index - 1] as any : null;
      const growthRate = previousData && previousData.totalRevenue > 0 
        ? ((data.totalRevenue - previousData.totalRevenue) / previousData.totalRevenue) * 100 
        : 0;

      return {
        ...data,
        averageTransaction: data.transactionCount > 0 ? data.totalRevenue / data.transactionCount : 0,
        growthRate
      };
    });

    return trendData;
  }

  // 전문가 매출 랭킹 조회
  async getExpertRankings(startDate?: string, endDate?: string, limit: number = 10): Promise<any> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.expert', 'expert')
      .leftJoinAndSelect('expert.user', 'expertUser')
      .where('payment.status = :status', { status: 'completed' });

    if (startDate) {
      queryBuilder.andWhere('payment.paid_at >= :startDate', { startDate: `${startDate} 00:00:00` });
    }

    if (endDate) {
      queryBuilder.andWhere('payment.paid_at <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const payments = await queryBuilder.getMany();

    // 전문가별 그룹핑
    const expertData: { [key: number]: any } = {};

    payments.forEach(payment => {
      const expertId = payment.expert_id;
      
      if (!expertData[expertId]) {
        expertData[expertId] = {
          expertId: expertId,
          expertName: payment.expert?.user?.name || '알 수 없음',
          totalRevenue: 0,
          transactionCount: 0,
          commission: 0,
          specialization: payment.expert?.specialization || '전문분야 미정',
          averageRating: 4.5 // 실제로는 리뷰 테이블에서 가져와야 함
        };
      }

      expertData[expertId].totalRevenue += payment.net_amount;
      expertData[expertId].transactionCount += 1;
      expertData[expertId].commission += payment.fee;
    });

    // 매출 순으로 정렬하고 제한
    const rankings = Object.values(expertData)
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return rankings;
  }

  // ======================
  // 기존 설문 관련 메서드들
  // ======================

  // 설문 문항 목록 조회 (관리자용)
  async getAllPsychQuestions(testId?: number): Promise<any[]> {
    const queryBuilder = this.psychQuestionRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.test', 'test')
      .orderBy('question.question_order', 'ASC');

    if (testId) {
      queryBuilder.where('question.test_id = :testId', { testId });
    }

    const questions = await queryBuilder.getMany();

    return questions.map(q => ({
      id: q.id,
      test_id: q.test_id,
      test_title: q.test?.title || null,
      question: q.question,
      question_order: q.question_order,
      question_type: q.question_type,
      options: q.options,
      is_required: q.is_required,
      help_text: q.help_text,
      created_at: q.created_at
    }));
  }

  // 설문 문항 생성 (관리자용)
  async createPsychQuestion(questionData: {
    test_id: number;
    question: string;
    question_type: QuestionType;
    question_order: number;
    options?: any[];
    is_required?: boolean;
    help_text?: string;
  }): Promise<any> {
    // 테스트 존재 확인
    const test = await this.psychTestRepository.findOne({
      where: { id: questionData.test_id }
    });

    if (!test) {
      throw new NotFoundException('설문 테스트를 찾을 수 없습니다.');
    }

    const question = this.psychQuestionRepository.create({
      test_id: questionData.test_id,
      question: questionData.question,
      question_type: questionData.question_type,
      question_order: questionData.question_order,
      options: questionData.options || [],
      is_required: questionData.is_required ?? false,
      help_text: questionData.help_text
    });

    const savedQuestion = await this.psychQuestionRepository.save(question);

    return {
      id: savedQuestion.id,
      test_id: savedQuestion.test_id,
      question: savedQuestion.question,
      question_order: savedQuestion.question_order,
      question_type: savedQuestion.question_type,
      options: savedQuestion.options,
      is_required: savedQuestion.is_required,
      help_text: savedQuestion.help_text,
      created_at: savedQuestion.created_at
    };
  }

  // 설문 문항 수정 (관리자용)
  async updatePsychQuestion(questionId: number, questionData: {
    question?: string;
    question_type?: QuestionType;
    question_order?: number;
    options?: any[];
    is_required?: boolean;
    help_text?: string;
  }): Promise<any> {
    const question = await this.psychQuestionRepository.findOne({
      where: { id: questionId },
      relations: ['test']
    });

    if (!question) {
      throw new NotFoundException('설문 문항을 찾을 수 없습니다.');
    }

    // 업데이트할 필드들만 적용
    Object.keys(questionData).forEach(key => {
      if (questionData[key] !== undefined) {
        question[key] = questionData[key];
      }
    });

    const savedQuestion = await this.psychQuestionRepository.save(question);

    return {
      id: savedQuestion.id,
      test_id: savedQuestion.test_id,
      test_title: question.test?.title || null,
      question: savedQuestion.question,
      question_order: savedQuestion.question_order,
      question_type: savedQuestion.question_type,
      options: savedQuestion.options,
      is_required: savedQuestion.is_required,
      help_text: savedQuestion.help_text,
      created_at: savedQuestion.created_at
    };
  }

  // 설문 문항 삭제 (관리자용)
  async deletePsychQuestion(questionId: number): Promise<{ success: boolean; message: string }> {
    const question = await this.psychQuestionRepository.findOne({
      where: { id: questionId }
    });

    if (!question) {
      throw new NotFoundException('설문 문항을 찾을 수 없습니다.');
    }

    await this.psychQuestionRepository.remove(question);

    return {
      success: true,
      message: '설문 문항이 성공적으로 삭제되었습니다.'
    };
  }

  // ======================
  // 시스템 로그 관리 메서드
  // ======================

  // 시스템 로그 목록 조회
  async getSystemLogs(query: SystemLogQueryDto): Promise<SystemLogListResponseDto> {
    const {
      search,
      level,
      category,
      userId,
      start_date,
      end_date,
      page = 1,
      limit = 20
    } = query;

    const queryBuilder = this.systemLogRepository
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC');

    // 검색 조건 추가
    if (search) {
      queryBuilder.andWhere(
        '(log.action ILIKE :search OR log.details ILIKE :search OR log.userName ILIKE :search OR log.ipAddress ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (level) {
      queryBuilder.andWhere('log.level = :level', { level });
    }

    if (category) {
      queryBuilder.andWhere('log.category = :category', { category });
    }

    if (userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId });
    }

    if (start_date) {
      queryBuilder.andWhere('log.timestamp >= :startDate', { 
        startDate: `${start_date} 00:00:00` 
      });
    }

    if (end_date) {
      queryBuilder.andWhere('log.timestamp <= :endDate', { 
        endDate: `${end_date} 23:59:59` 
      });
    }

    // 페이지네이션
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // 총 개수와 데이터 조회
    const [logs, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    // 응답 데이터 변환
    const data: SystemLogResponseDto[] = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      category: log.category,
      action: log.action,
      userId: log.userId,
      userType: log.userType,
      userName: log.userName,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.details,
      requestId: log.requestId,
      responseTime: log.responseTime,
      statusCode: log.statusCode,
      errorMessage: log.errorMessage,
      stackTrace: log.stackTrace,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // 시스템 로그 통계 조회
  async getSystemLogStats(start_date?: string, end_date?: string): Promise<SystemLogStatsDto> {
    const queryBuilder = this.systemLogRepository.createQueryBuilder('log');

    if (start_date) {
      queryBuilder.andWhere('log.timestamp >= :startDate', { 
        startDate: `${start_date} 00:00:00` 
      });
    }

    if (end_date) {
      queryBuilder.andWhere('log.timestamp <= :endDate', { 
        endDate: `${end_date} 23:59:59` 
      });
    }

    // 전체 통계
    const totalQuery = queryBuilder.clone();
    const total = await totalQuery.getCount();

    // 오늘 통계
    const today = new Date().toISOString().split('T')[0];
    const todayQuery = this.systemLogRepository
      .createQueryBuilder('log')
      .where('log.timestamp >= :todayStart', { todayStart: `${today} 00:00:00` })
      .andWhere('log.timestamp <= :todayEnd', { todayEnd: `${today} 23:59:59` });
    
    if (start_date && start_date > today) {
      todayQuery.andWhere('1=0'); // 시작 날짜가 오늘보다 미래면 0개
    }
    
    const todayCount = await todayQuery.getCount();

    // 레벨별 통계
    const levelStats = await this.systemLogRepository
      .createQueryBuilder('log')
      .select('log.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .where(start_date ? 'log.timestamp >= :startDate' : '1=1', start_date ? { startDate: `${start_date} 00:00:00` } : {})
      .andWhere(end_date ? 'log.timestamp <= :endDate' : '1=1', end_date ? { endDate: `${end_date} 23:59:59` } : {})
      .groupBy('log.level')
      .getRawMany();

    // 카테고리별 통계
    const categoryStats = await this.systemLogRepository
      .createQueryBuilder('log')
      .select('log.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where(start_date ? 'log.timestamp >= :startDate' : '1=1', start_date ? { startDate: `${start_date} 00:00:00` } : {})
      .andWhere(end_date ? 'log.timestamp <= :endDate' : '1=1', end_date ? { endDate: `${end_date} 23:59:59` } : {})
      .groupBy('log.category')
      .getRawMany();

    // 에러, 경고 개수
    const errors = levelStats.find(stat => stat.level === LogLevel.ERROR)?.count || 0;
    const warnings = levelStats.find(stat => stat.level === LogLevel.WARN)?.count || 0;

    // 레벨별 통계 객체 생성
    const levelStatsObj = {
      debug: parseInt(levelStats.find(stat => stat.level === LogLevel.DEBUG)?.count || '0'),
      info: parseInt(levelStats.find(stat => stat.level === LogLevel.INFO)?.count || '0'),
      warn: parseInt(levelStats.find(stat => stat.level === LogLevel.WARN)?.count || '0'),
      error: parseInt(levelStats.find(stat => stat.level === LogLevel.ERROR)?.count || '0'),
    };

    // 카테고리별 통계 객체 생성
    const categoryStatsObj: { [key: string]: number } = {};
    categoryStats.forEach(stat => {
      categoryStatsObj[stat.category] = parseInt(stat.count);
    });

    return {
      total,
      today: todayCount,
      errors: parseInt(String(errors)),
      warnings: parseInt(String(warnings)),
      levelStats: levelStatsObj,
      categoryStats: categoryStatsObj,
    };
  }

  // 시스템 로그 상세 조회
  async getSystemLogById(id: number): Promise<SystemLogResponseDto> {
    const log = await this.systemLogRepository.findOne({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException('로그를 찾을 수 없습니다.');
    }

    return {
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      category: log.category,
      action: log.action,
      userId: log.userId,
      userType: log.userType,
      userName: log.userName,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.details,
      requestId: log.requestId,
      responseTime: log.responseTime,
      statusCode: log.statusCode,
      errorMessage: log.errorMessage,
      stackTrace: log.stackTrace,
      createdAt: log.createdAt.toISOString(),
    };
  }

  // 오래된 로그 정리
  async cleanupOldLogs(
    days: number, 
    adminId: number, 
    adminName: string, 
    ipAddress: string
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deleteResult = await this.systemLogRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute();

    const deletedCount = deleteResult.affected || 0;

    // 정리 작업 로그 기록
    const cleanupLog = this.systemLogRepository.create({
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: LogCategory.ADMIN,
      action: 'LOG_CLEANUP',
      userId: adminId,
      userType: 'admin',
      userName: adminName,
      ipAddress: ipAddress,
      userAgent: 'Admin Panel',
      details: `${days}일 이전 시스템 로그 정리 완료 (삭제된 로그: ${deletedCount}개)`,
    });

    await this.systemLogRepository.save(cleanupLog);

    LoggerUtil.info(`시스템 로그 정리 완료`, {
      days,
      deletedCount,
      adminId,
      adminName,
    });

    return {
      success: true,
      message: `${days}일 이전 로그 ${deletedCount}개가 삭제되었습니다.`,
      deletedCount,
    };
  }

  // 시스템 로그 내보내기
  async exportSystemLogs(
    query: SystemLogQueryDto,
    adminId: number,
    adminName: string,
    ipAddress: string
  ): Promise<{ success: boolean; downloadUrl: string; fileName: string }> {
    // 내보내기 요청 로그 기록
    const exportLog = this.systemLogRepository.create({
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: LogCategory.ADMIN,
      action: 'LOG_EXPORT_REQUEST',
      userId: adminId,
      userType: 'admin',
      userName: adminName,
      ipAddress: ipAddress,
      userAgent: 'Admin Panel',
      details: `시스템 로그 내보내기 요청 (필터: ${JSON.stringify(query)})`,
    });

    await this.systemLogRepository.save(exportLog);

    // 실제 구현에서는 CSV 파일 생성 및 다운로드 URL 생성
    // 여기서는 임시로 성공 응답만 반환
    const fileName = `system_logs_${new Date().toISOString().split('T')[0]}.csv`;
    const downloadUrl = `/api/admin/system/logs/download/${fileName}`;

    LoggerUtil.info(`시스템 로그 내보내기 요청`, {
      adminId,
      adminName,
      fileName,
      query,
    });

    return {
      success: true,
      downloadUrl,
      fileName,
    };
  }
}