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
    try {
      console.log('🔄 대시보드 통계 조회 시작...');
      
      // 각 통계를 개별적으로 처리하여 하나가 실패해도 다른 것들은 가져올 수 있도록 함
      const [
        userStats,
        expertStats,
        counselingStats,
        contentStats,
        psychTestStats,
        systemStats,
      ] = await Promise.allSettled([
        this.getUserStats(),
        this.getExpertStats(),
        this.getDashboardCounselingStats(),
        this.getContentStats(),
        this.getPsychTestStats(),
        this.getSystemStats(),
      ]);

      console.log('📊 통계 조회 결과:', {
        users: userStats.status,
        experts: expertStats.status,
        counselings: counselingStats.status,
        contents: contentStats.status,
        psychTests: psychTestStats.status,
        system: systemStats.status,
      });

      // 실패한 통계들을 위한 기본값
      const defaultUserStats = { total_users: 0, active_users: 0, pending_users: 0, inactive_users: 0, new_users_today: 0, new_users_this_week: 0, new_users_this_month: 0 };
      const defaultExpertStats = { total_experts: 0, verified_experts: 0, pending_verification: 0, active_experts: 0, average_rating: 0 };
      const defaultCounselingStats = { total_counselings: 0, completed_counselings: 0, pending_counselings: 0, cancelled_counselings: 0, counselings_today: 0, counselings_this_week: 0, counselings_this_month: 0, average_session_duration: 0 };
      const defaultContentStats = { total_contents: 0, published_contents: 0, draft_contents: 0, total_views: 0, total_likes: 0, most_viewed_content: null };
      const defaultPsychTestStats = { total_tests: 0, active_tests: 0, total_responses: 0, responses_today: 0, responses_this_week: 0, responses_this_month: 0, most_popular_test: null };
      const defaultSystemStats = { total_notifications: 0, unread_notifications: 0, chat_messages_today: 0, login_sessions_today: 0, server_uptime: '0 seconds', database_size: '0 MB' };

      return {
        users: userStats.status === 'fulfilled' ? userStats.value : defaultUserStats,
        experts: expertStats.status === 'fulfilled' ? expertStats.value : defaultExpertStats,
        counselings: counselingStats.status === 'fulfilled' ? counselingStats.value : defaultCounselingStats,
        contents: contentStats.status === 'fulfilled' ? contentStats.value : defaultContentStats,
        psych_tests: psychTestStats.status === 'fulfilled' ? psychTestStats.value : defaultPsychTestStats,
        system: systemStats.status === 'fulfilled' ? systemStats.value : defaultSystemStats,
        generated_at: new Date(),
      };
    } catch (error) {
      console.error('❌ 대시보드 통계 조회 실패:', error);
      throw error;
    }
  }

  async getUsers(query: AdminUserQueryDto): Promise<AdminUserListResponseDto> {
    // 기본 사용자 정보와 센터 정보 조회
    const baseQueryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.expertProfile', 'expert')
      .leftJoinAndSelect('user.center', 'center');

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
          u.user_id,
          COUNT(DISTINCT c1.id) as user_counseling_count,
          COUNT(DISTINCT CASE WHEN c1.status = 'completed' THEN c1.id END) as user_completed_sessions,
          COUNT(DISTINCT c2.id) as expert_counseling_count,
          COUNT(DISTINCT CASE WHEN c2.status = 'completed' THEN c2.id END) as expert_completed_sessions
        FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
        LEFT JOIN counselings c1 ON c1.user_id = u.user_id
        LEFT JOIN counselings c2 ON c2.expert_id = u.user_id
        GROUP BY u.user_id
      `, userIds);

      const paymentStats = await this.userRepository.query(`
        SELECT u.user_id, COALESCE(SUM(amount), 0) as total_payments
        FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
        LEFT JOIN payments p ON p.user_id = u.user_id AND p.status = 'completed'
        GROUP BY u.user_id
      `, userIds);

      const loginStats = await this.userRepository.query(`
        SELECT 
          u.user_id, 
          COUNT(CASE WHEN sl.id IS NOT NULL THEN 1 END) as login_count, 
          MAX(sl.timestamp) as last_login_at
        FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
        LEFT JOIN system_logs sl ON sl.user_id = u.user_id AND sl.action = 'USER_LOGIN'
        GROUP BY u.user_id
      `, userIds);

      // 병렬로 처리할 수 있는 가벼운 쿼리들
      const [contentStats, psychTestStats] = await Promise.all([
        this.userRepository.query(`
          SELECT u.user_id, COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END) as content_count
          FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
          LEFT JOIN contents c ON c.author_id = u.user_id
          GROUP BY u.user_id
        `, userIds),

        this.userRepository.query(`
          SELECT u.user_id, COUNT(CASE WHEN pr.id IS NOT NULL THEN 1 END) as psych_test_count
          FROM (VALUES ${userIds.map((id, idx) => `($${idx + 1}::integer)`).join(',')}) as u(user_id)
          LEFT JOIN psych_results pr ON pr.user_id = u.user_id
          GROUP BY u.user_id
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
        
        // 센터 정보 매핑
        userDto.center_id = user.center_id;
        userDto.center_name = user.center?.name;
        userDto.center_code = user.center?.code;
        
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
      
      // 센터 정보 매핑
      userDto.center_id = user.center_id;
      userDto.center_name = user.center?.name;
      userDto.center_code = user.center?.code;
      
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
        .where('user.created_at >= NOW() - INTERVAL \'7 days\'')
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where('user.created_at >= NOW() - INTERVAL \'30 days\'')
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

  private async getDashboardCounselingStats() {
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
        .where('counseling.created_at >= NOW() - INTERVAL \'7 days\'')
        .getCount(),
      this.counselingRepository
        .createQueryBuilder('counseling')
        .where('counseling.created_at >= NOW() - INTERVAL \'30 days\'')
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
        .where('result.completed_at >= NOW() - INTERVAL \'7 days\'')
        .getCount(),
      this.psychResultRepository
        .createQueryBuilder('result')
        .where('result.completed_at >= NOW() - INTERVAL \'30 days\'')
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

      // null 값 처리 (NaN 포함)
      if (userUpdateFields.center_id === null || 
          userUpdateFields.center_id === undefined || 
          isNaN(userUpdateFields.center_id)) {
        userUpdateFields.center_id = null;
      }
      if (userUpdateFields.supervisor_id === null || 
          userUpdateFields.supervisor_id === undefined || 
          isNaN(userUpdateFields.supervisor_id)) {
        userUpdateFields.supervisor_id = null;
      }
      if (userUpdateFields.phone === null || userUpdateFields.phone === undefined || userUpdateFields.phone === '') {
        userUpdateFields.phone = null;
      }

      // 사용자 정보 업데이트
      if (Object.keys(userUpdateFields).length > 0) {
        console.log(`🔍 Final userUpdateFields before DB update:`, userUpdateFields);
        await manager.update(User, userId, userUpdateFields);
        console.log(`✅ User ${userId} updated successfully`);
      } else {
        console.log(`⚠️ No user fields to update for user ${userId}`);
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


  // =====================================================
  // 통합 상담 관리 메서드 (schedules → counselings 통합)
  // =====================================================

  /**
   * 모든 상담 조회 (관리자용) - schedules 대체
   */
  async getAllCounselings(centerId?: number): Promise<{
    counselings: any[];
    totalCounselings: number;
    availableSlots: number;
    pendingCounselings: number;
    approvedCounselings: number;
    inProgressCounselings: number;
    completedCounselings: number;
    cancelledCounselings: number;
    rejectedCounselings: number;
  }> {
    const queryBuilder = this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.user', 'user')
      .leftJoinAndSelect('counseling.expert', 'expert')
      .leftJoinAndSelect('expert.center', 'center')
      .orderBy('counseling.schedule_date', 'DESC')
      .addOrderBy('counseling.start_time', 'DESC');

    // 센터 필터링
    if (centerId) {
      queryBuilder.andWhere('expert.center_id = :centerId', { centerId });
    }

    const counselings = await queryBuilder.getMany();

    // 상태별 카운트 계산
    const totalCounselings = counselings.length;
    const availableSlots = counselings.filter(c => c.user_id === null && c.status === CounselingStatus.AVAILABLE).length;
    const pendingCounselings = counselings.filter(c => c.status === CounselingStatus.PENDING).length;
    const approvedCounselings = counselings.filter(c => c.status === CounselingStatus.APPROVED).length;
    const inProgressCounselings = counselings.filter(c => c.status === CounselingStatus.IN_PROGRESS).length;
    const completedCounselings = counselings.filter(c => c.status === CounselingStatus.COMPLETED).length;
    const cancelledCounselings = counselings.filter(c => c.status === CounselingStatus.CANCELLED).length;
    const rejectedCounselings = counselings.filter(c => c.status === CounselingStatus.REJECTED).length;

    // 응답 데이터 포맷팅
    const formattedCounselings = counselings.map(counseling => ({
      id: counseling.id,
      title: counseling.title,
      scheduleDate: counseling.schedule_date,
      startTime: counseling.start_time,
      endTime: counseling.end_time,
      duration: counseling.duration,
      type: counseling.type,
      status: counseling.status,
      reason: counseling.reason,
      notes: counseling.notes,
      paymentAmount: counseling.payment_amount,
      paymentStatus: counseling.payment_status,
      createdAt: counseling.created_at,
      updatedAt: counseling.updated_at,
      expert: counseling.expert ? {
        id: counseling.expert.id,
        name: counseling.expert.name,
        center: counseling.expert.center ? {
          id: counseling.expert.center.id,
          name: counseling.expert.center.name
        } : null
      } : null,
      user: counseling.user ? {
        id: counseling.user.id,
        name: counseling.user.name
      } : null,
      // 호환성을 위한 client 필드
      client: counseling.user ? {
        id: counseling.user.id,
        name: counseling.user.name
      } : null,
      isAvailableSlot: counseling.user_id === null && counseling.status === CounselingStatus.AVAILABLE
    }));

    LoggerUtil.info('관리자 상담 목록 조회 완료', {
      centerId,
      totalCounselings,
      availableSlots,
      pendingCounselings
    });

    return {
      counselings: formattedCounselings,
      totalCounselings,
      availableSlots,
      pendingCounselings,
      approvedCounselings,
      inProgressCounselings,
      completedCounselings,
      cancelledCounselings,
      rejectedCounselings
    };
  }

  /**
   * 상담 취소 (관리자용) - schedules 대체
   */
  async cancelCounseling(counselingId: number, adminId: number): Promise<{ success: boolean; message: string }> {
    const counseling = await this.counselingRepository.findOne({
      where: { id: counselingId },
      relations: ['user', 'expert']
    });

    if (!counseling) {
      throw new NotFoundException('상담을 찾을 수 없습니다.');
    }

    // 이미 취소된 상담인지 확인
    if (counseling.status === CounselingStatus.CANCELLED) {
      throw new BadRequestException('이미 취소된 상담입니다.');
    }

    // 완료된 상담은 취소할 수 없음
    if (counseling.status === CounselingStatus.COMPLETED) {
      throw new BadRequestException('완료된 상담은 취소할 수 없습니다.');
    }

    // 상담 상태를 취소로 변경
    counseling.status = CounselingStatus.CANCELLED;
    counseling.notes = `${counseling.notes ? counseling.notes + ' | ' : ''}관리자에 의해 취소됨`;
    counseling.updated_at = new Date();

    await this.counselingRepository.save(counseling);

    LoggerUtil.info('관리자에 의한 상담 취소 처리', {
      counselingId,
      expertId: counseling.expert_id,
      userId: counseling.user_id,
      adminId
    });

    return {
      success: true,
      message: '상담이 성공적으로 취소되었습니다.'
    };
  }

  /**
   * 상담 통계 조회 (관리자용)
   */
  async getCounselingStats(centerId?: number): Promise<{
    totalCounselings: number;
    todayCounselings: number;
    thisWeekCounselings: number;
    thisMonthCounselings: number;
    statusStats: Record<string, number>;
    typeStats: Record<string, number>;
    recentActivity: Array<{ date: string; count: number }>;
  }> {
    const queryBuilder = this.counselingRepository
      .createQueryBuilder('counseling')
      .leftJoinAndSelect('counseling.expert', 'expert');

    if (centerId) {
      queryBuilder.andWhere('expert.center_id = :centerId', { centerId });
    }

    const allCounselings = await queryBuilder.getMany();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today.getTime() - ((today.getDay() + 6) % 7) * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalCounselings = allCounselings.length;
    const todayCounselings = allCounselings.filter(c =>
      new Date(c.schedule_date) >= today
    ).length;
    const thisWeekCounselings = allCounselings.filter(c =>
      new Date(c.schedule_date) >= thisWeekStart
    ).length;
    const thisMonthCounselings = allCounselings.filter(c =>
      new Date(c.schedule_date) >= thisMonthStart
    ).length;

    // 상태별 통계
    const statusStats = allCounselings.reduce((acc, counseling) => {
      acc[counseling.status] = (acc[counseling.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 타입별 통계
    const typeStats = allCounselings.reduce((acc, counseling) => {
      acc[counseling.type] = (acc[counseling.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 최근 7일 활동 통계
    const recentActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = allCounselings.filter(c =>
        c.schedule_date === dateStr
      ).length;
      recentActivity.push({ date: dateStr, count });
    }

    return {
      totalCounselings,
      todayCounselings,
      thisWeekCounselings,
      thisMonthCounselings,
      statusStats,
      typeStats,
      recentActivity
    };
  }

  // TODO: Implement remaining methods that were removed during migration
  async getAllExperts(): Promise<any[]> {
    console.log('getAllExperts Mock 데이터 반환 중...');
    
    return [
      {
        id: 1,
        user: {
          id: 1,
          name: '이상담사',
          email: 'expert1@example.com',
          phone: '010-1234-5678',
          userType: 'expert',
          status: 'active',
          createdAt: '2024-01-15T09:00:00.000Z'
        },
        licenseNumber: 'PSY-2024-001',
        licenseType: '임상심리사 1급',
        yearsExperience: 8,
        hourlyRate: 80000,
        isVerified: true,
        specialization: ['우울증', '불안장애', '부부상담'],
        introduction: '8년간의 임상 경험을 바탕으로 우울증과 불안장애 전문 상담을 제공합니다.',
        education: '서울대학교 심리학과 박사',
        certifications: ['임상심리사 1급', '가족상담사', 'CBT 치료사'],
        consultationSettings: {
          video: true,
          chat: true,
          voice: true
        },
        pricingSettings: {
          video: 80000,
          chat: 50000,
          voice: 60000
        },
        rating: 4.8,
        reviewCount: 156,
        centerId: 1,
        centerName: '서울심리상담센터',
        createdAt: '2024-01-15T09:00:00.000Z',
        updatedAt: '2024-09-10T16:30:00.000Z'
      },
      {
        id: 2,
        user: {
          id: 2,
          name: '박전문가',
          email: 'expert2@example.com',
          phone: '010-2345-6789',
          userType: 'expert',
          status: 'active',
          createdAt: '2024-02-01T10:00:00.000Z'
        },
        licenseNumber: 'PSY-2024-002',
        licenseType: '상담심리사 1급',
        yearsExperience: 12,
        hourlyRate: 100000,
        isVerified: true,
        specialization: ['트라우마', 'PTSD', '청소년 상담'],
        introduction: '트라우마와 PTSD 전문으로 12년간 상담해왔습니다.',
        education: '연세대학교 심리학과 박사',
        certifications: ['상담심리사 1급', 'EMDR 치료사', '아동청소년 상담사'],
        consultationSettings: {
          video: true,
          chat: false,
          voice: true
        },
        pricingSettings: {
          video: 100000,
          chat: 0,
          voice: 80000
        },
        rating: 4.9,
        reviewCount: 203,
        centerId: 1,
        centerName: '서울심리상담센터',
        createdAt: '2024-02-01T10:00:00.000Z',
        updatedAt: '2024-09-08T14:15:00.000Z'
      },
      {
        id: 3,
        user: {
          id: 3,
          name: '김심리사',
          email: 'expert3@example.com',
          phone: '010-3456-7890',
          userType: 'expert',
          status: 'active',
          createdAt: '2024-03-01T11:00:00.000Z'
        },
        licenseNumber: 'PSY-2024-003',
        licenseType: '임상심리사 2급',
        yearsExperience: 5,
        hourlyRate: 60000,
        isVerified: true,
        specialization: ['아동상담', '학습장애', '발달장애'],
        introduction: '아동 및 청소년 상담 전문가입니다.',
        education: '고려대학교 심리학과 석사',
        certifications: ['임상심리사 2급', '놀이치료사', '언어치료사'],
        consultationSettings: {
          video: true,
          chat: true,
          voice: false
        },
        pricingSettings: {
          video: 60000,
          chat: 40000,
          voice: 0
        },
        rating: 4.6,
        reviewCount: 89,
        centerId: 2,
        centerName: '부산상담센터',
        createdAt: '2024-03-01T11:00:00.000Z',
        updatedAt: '2024-09-05T09:45:00.000Z'
      }
    ];
  }

  async getExpertWorkingHours(expertId: number, startDate: string, endDate: string): Promise<any> {
    console.log('getExpertWorkingHours Mock 데이터 반환 중...');
    
    return {
      expertId,
      expertName: '이상담사',
      period: { startDate, endDate },
      workingHours: [
        {
          date: '2024-09-05',
          startTime: '09:00:00',
          endTime: '18:00:00',
          totalHours: 8.0,
          breakTime: 1.0,
          actualWorkHours: 7.0,
          sessionsCount: 6,
          sessionHours: 5.5,
          logs: [
            { status: 'started', time: '09:00', notes: '정시 출근' },
            { status: 'break_start', time: '12:00', notes: '점심시간' },
            { status: 'break_end', time: '13:00', notes: '점심시간 종료' },
            { status: 'finished', time: '18:00', notes: '정시 퇴근' }
          ]
        },
        {
          date: '2024-09-06',
          startTime: '09:15:00',
          endTime: '17:45:00',
          totalHours: 7.5,
          breakTime: 1.0,
          actualWorkHours: 6.5,
          sessionsCount: 5,
          sessionHours: 4.5,
          logs: [
            { status: 'started', time: '09:15', notes: '15분 지각' },
            { status: 'break_start', time: '12:30', notes: '점심시간' },
            { status: 'break_end', time: '13:30', notes: '점심시간 종료' },
            { status: 'finished', time: '17:45', notes: '15분 일찍 퇴근' }
          ]
        },
        {
          date: '2024-09-07',
          startTime: '08:45:00',
          endTime: '18:30:00',
          totalHours: 8.75,
          breakTime: 1.0,
          actualWorkHours: 7.75,
          sessionsCount: 8,
          sessionHours: 7.0,
          logs: [
            { status: 'started', time: '08:45', notes: '15분 일찍 출근' },
            { status: 'break_start', time: '12:00', notes: '점심시간' },
            { status: 'break_end', time: '13:00', notes: '점심시간 종료' },
            { status: 'finished', time: '18:30', notes: '30분 연장근무' }
          ]
        }
      ],
      totalWorkingDays: 3,
      totalHours: 23.25,
      totalActualWorkHours: 21.25,
      totalSessionHours: 17.0,
      averageHoursPerDay: 7.08,
      averageSessionsPerDay: 6.3,
      efficiencyRate: 0.73, // 실제 상담시간 / 총 근무시간
      vacations: [
        {
          startDate: '2024-09-09',
          endDate: '2024-09-09',
          type: 'personal',
          reason: '개인사정'
        }
      ]
    };
  }

  async getAllPsychTests(): Promise<any[]> {
    console.log('getAllPsychTests Mock 데이터 반환 중...');
    
    return [
      {
        id: 1,
        name: 'MMPI-2 성격검사',
        description: 'Minnesota Multiphasic Personality Inventory-2 성격 및 정신병리 검사',
        category: 'personality',
        duration: 60,
        questionCount: 567,
        isActive: true,
        price: 35000,
        instructions: '각 문항에 대해 참 또는 거짓으로 답해주세요.',
        createdAt: '2024-01-15T09:00:00.000Z',
        updatedAt: '2024-08-20T14:30:00.000Z'
      },
      {
        id: 2,
        name: 'K-WAIS-IV 지능검사',
        description: 'Korean Wechsler Adult Intelligence Scale-IV 성인 지능검사',
        category: 'intelligence',
        duration: 90,
        questionCount: 15,
        isActive: true,
        price: 45000,
        instructions: '검사자의 지시에 따라 각 과제를 수행해주세요.',
        createdAt: '2024-02-01T10:00:00.000Z',
        updatedAt: '2024-08-15T16:45:00.000Z'
      },
      {
        id: 3,
        name: '우울증 자가진단 척도 (BDI-II)',
        description: 'Beck Depression Inventory-II 우울증 자가진단 검사',
        category: 'depression',
        duration: 15,
        questionCount: 21,
        isActive: true,
        price: 15000,
        instructions: '지난 2주간의 상태를 기준으로 가장 적절한 답을 선택해주세요.',
        createdAt: '2024-02-10T11:00:00.000Z',
        updatedAt: '2024-09-01T09:15:00.000Z'
      },
      {
        id: 4,
        name: '불안장애 진단 척도 (GAD-7)',
        description: 'Generalized Anxiety Disorder-7 범불안장애 선별검사',
        category: 'anxiety',
        duration: 10,
        questionCount: 7,
        isActive: true,
        price: 12000,
        instructions: '지난 2주 동안 얼마나 자주 다음과 같은 문제들로 괴로웠는지 표시해주세요.',
        createdAt: '2024-03-05T13:30:00.000Z',
        updatedAt: '2024-08-25T10:20:00.000Z'
      }
    ];
  }

  async createPsychTest(testData: any): Promise<any> {
    // TODO: Implement psychological test creation
    console.log('createPsychTest 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: 1, ...testData };
  }

  async getPsychTestById(testId: number): Promise<any> {
    // TODO: Implement psychological test retrieval by ID
    console.log('getPsychTestById 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: testId };
  }

  async getAllPsychQuestions(testId?: number): Promise<any[]> {
    console.log('getAllPsychQuestions Mock 데이터 반환 중...');
    
    if (testId) {
      // 특정 테스트의 문항들 반환
      return [
        {
          id: 1,
          testId: testId,
          questionNumber: 1,
          questionText: '나는 대체로 기분이 좋다.',
          questionType: 'true_false',
          isRequired: true,
          options: null,
          correctAnswer: null,
          weight: 1.0,
          category: 'mood',
          createdAt: '2024-01-15T09:30:00.000Z'
        },
        {
          id: 2,
          testId: testId,
          questionNumber: 2,
          questionText: '나는 때때로 슬픔을 느낀다.',
          questionType: 'true_false',
          isRequired: true,
          options: null,
          correctAnswer: null,
          weight: 1.0,
          category: 'mood',
          createdAt: '2024-01-15T09:31:00.000Z'
        }
      ];
    }
    
    // 전체 문항 목록 반환
    return [
      {
        id: 1,
        testId: 1,
        testName: 'MMPI-2 성격검사',
        questionNumber: 1,
        questionText: '나는 대체로 기분이 좋다.',
        questionType: 'true_false',
        isRequired: true,
        category: 'mood'
      },
      {
        id: 2,
        testId: 1,
        testName: 'MMPI-2 성격검사',
        questionNumber: 2,
        questionText: '나는 때때로 슬픔을 느낀다.',
        questionType: 'true_false',
        isRequired: true,
        category: 'mood'
      },
      {
        id: 3,
        testId: 2,
        testName: 'K-WAIS-IV 지능검사',
        questionNumber: 1,
        questionText: '다음 숫자 패턴에서 빠진 숫자를 찾으세요: 2, 4, 6, 8, ?',
        questionType: 'multiple_choice',
        isRequired: true,
        category: 'pattern'
      },
      {
        id: 4,
        testId: 3,
        testName: '우울증 자가진단 척도 (BDI-II)',
        questionNumber: 1,
        questionText: '슬픔',
        questionType: 'scale',
        isRequired: true,
        category: 'depression'
      }
    ];
  }

  // Additional missing methods
  async createPsychQuestion(questionData: any): Promise<any> {
    console.log('createPsychQuestion 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: 1, ...questionData };
  }

  async updatePsychQuestion(questionId: number, questionData: any): Promise<any> {
    console.log('updatePsychQuestion 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: questionId, ...questionData };
  }

  async deletePsychQuestion(questionId: number): Promise<any> {
    console.log('deletePsychQuestion 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { success: true, message: 'Question deleted' };
  }

  async getAllLogicRules(testId?: number): Promise<any[]> {
    console.log('getAllLogicRules 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return [];
  }

  async createLogicRule(ruleData: any): Promise<any> {
    console.log('createLogicRule 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: 1, ...ruleData };
  }

  async updateLogicRule(ruleId: number, ruleData: any): Promise<any> {
    console.log('updateLogicRule 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: ruleId, ...ruleData };
  }

  async deleteLogicRule(ruleId: number): Promise<any> {
    console.log('deleteLogicRule 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { success: true, message: 'Rule deleted' };
  }

  async toggleLogicRuleStatus(ruleId: number): Promise<any> {
    console.log('toggleLogicRuleStatus 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: ruleId, isActive: true };
  }

  async getAllPayments(options: any): Promise<any> {
    console.log('getAllPayments Mock 데이터 반환 중...');
    
    // Mock 결제 데이터
    const mockPayments = [
      {
        id: 1,
        transactionId: 'TXN_20240825_001',
        userId: 1,
        userName: '김내담자',
        userEmail: 'client1@example.com',
        expertId: 1,
        expertName: '이상담사',
        serviceType: 'video',
        serviceName: '화상 상담 (50분)',
        amount: 80000,
        fee: 8000,
        netAmount: 72000,
        paymentMethod: 'card',
        paymentProvider: '국민카드',
        status: 'completed',
        paidAt: '2024-08-25T14:30:00.000Z',
        sessionDuration: 50,
        createdAt: '2024-08-25T14:00:00.000Z'
      },
      {
        id: 2,
        transactionId: 'TXN_20240825_002',
        userId: 1,
        userName: '김내담자',
        userEmail: 'client1@example.com',
        expertId: 1,
        expertName: '이상담사',
        serviceType: 'test',
        serviceName: 'MMPI-2 성격검사',
        amount: 35000,
        fee: 5250,
        netAmount: 29750,
        paymentMethod: 'kakao',
        paymentProvider: '카카오페이',
        status: 'completed',
        paidAt: '2024-08-25T11:20:00.000Z',
        sessionDuration: null,
        createdAt: '2024-08-25T11:00:00.000Z'
      },
      {
        id: 3,
        transactionId: 'TXN_20240824_001',
        userId: 2,
        userName: '박환자',
        userEmail: 'client2@example.com',
        expertId: 1,
        expertName: '이상담사',
        serviceType: 'chat',
        serviceName: '채팅 상담 (1시간)',
        amount: 50000,
        fee: 5000,
        netAmount: 45000,
        paymentMethod: 'bank',
        paymentProvider: '우리은행',
        status: 'completed',
        paidAt: '2024-08-24T16:45:00.000Z',
        sessionDuration: 60,
        createdAt: '2024-08-24T16:30:00.000Z'
      }
    ];

    return {
      data: mockPayments,
      total: mockPayments.length,
      page: 1,
      totalPages: 1
    };
  }

  async getPaymentStats(startDate?: string, endDate?: string): Promise<any> {
    console.log('getPaymentStats Mock 데이터 반환 중...');
    
    return {
      totalRevenue: 2450000,
      totalTransactions: 28,
      totalFees: 245000,
      totalNetAmount: 2205000,
      averageTransactionAmount: 87500,
      paymentMethodStats: {
        card: { count: 15, amount: 1200000 },
        kakao: { count: 8, amount: 680000 },
        bank: { count: 3, amount: 350000 },
        paypal: { count: 2, amount: 220000 }
      },
      serviceTypeStats: {
        video: { count: 12, amount: 960000 },
        chat: { count: 8, amount: 400000 },
        voice: { count: 5, amount: 300000 },
        test: { count: 3, amount: 105000 }
      },
      dailyStats: [
        { date: '2024-09-05', revenue: 165000, transactions: 2 },
        { date: '2024-09-06', revenue: 245000, transactions: 3 },
        { date: '2024-09-07', revenue: 320000, transactions: 4 },
        { date: '2024-09-08', revenue: 280000, transactions: 3 },
        { date: '2024-09-09', revenue: 190000, transactions: 2 },
        { date: '2024-09-10', revenue: 375000, transactions: 5 },
        { date: '2024-09-11', revenue: 425000, transactions: 6 }
      ]
    };
  }

  async getPaymentById(paymentId: number): Promise<any> {
    console.log('getPaymentById 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id: paymentId };
  }

  async refundPayment(paymentId: number, reason: string): Promise<any> {
    console.log('refundPayment 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { success: true, message: 'Payment refunded' };
  }

  async getRevenueStats(periodType: string, startDate?: string, endDate?: string): Promise<any> {
    console.log('getRevenueStats 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { totalRevenue: 0, periodRevenue: [] };
  }

  async getRevenueTrends(periodType: string, startDate?: string, endDate?: string): Promise<any> {
    console.log('getRevenueTrends 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { trends: [] };
  }

  async getExpertRankings(startDate?: string, endDate?: string, limit?: number): Promise<any[]> {
    console.log('getExpertRankings 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return [];
  }

  async getUserRegistrationStats(startDate?: string, endDate?: string): Promise<any> {
    console.log('getUserRegistrationStats 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { totalRegistrations: 0, dailyStats: [] };
  }

  async getActiveUserStats(periodType: string): Promise<any> {
    console.log('getActiveUserStats 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { activeUsers: 0, activityStats: [] };
  }

  async getCounselingEfficiencyStats(startDate?: string, endDate?: string): Promise<any> {
    console.log('getCounselingEfficiencyStats 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { efficiency: 0, stats: [] };
  }

  async getCounselingPatternAnalysis(startDate?: string, endDate?: string): Promise<any> {
    console.log('getCounselingPatternAnalysis 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { patterns: [] };
  }

  async exportSystemData(options: any): Promise<any> {
    console.log('exportSystemData 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { success: true, exportUrl: '' };
  }

  async createSystemBackup(adminId: number, adminName: string, ip: string): Promise<any> {
    console.log('createSystemBackup 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { success: true, backupId: '1' };
  }

  async getUserActivityLogs(query: any): Promise<any> {
    console.log('getUserActivityLogs 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { logs: [], total: 0 };
  }

  async getUserActivityLogStats(query: any): Promise<any> {
    console.log('getUserActivityLogStats 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { stats: [] };
  }

  async getSystemLogs(query: any): Promise<any> {
    console.log('getSystemLogs Mock 데이터 반환 중...');
    
    const mockLogs = [
      {
        id: 1,
        timestamp: '2024-09-11T10:30:45.123Z',
        level: 'info',
        category: 'auth',
        action: 'USER_LOGIN',
        userId: 1,
        userType: 'client',
        userName: '김내담자',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        details: '사용자 로그인 성공',
        requestId: 'req_20240911_001',
        responseTime: 150,
        statusCode: 200,
        createdAt: '2024-09-11T10:30:45.123Z'
      },
      {
        id: 2,
        timestamp: '2024-09-11T10:25:32.456Z',
        level: 'error',
        category: 'payment',
        action: 'PAYMENT_FAILED',
        userId: 2,
        userType: 'client',
        userName: '박환자',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        details: '결제 처리 중 오류 발생 - 카드 한도 초과',
        requestId: 'req_20240911_002',
        responseTime: 3000,
        statusCode: 400,
        errorMessage: 'Card limit exceeded',
        createdAt: '2024-09-11T10:25:32.456Z'
      },
      {
        id: 3,
        timestamp: '2024-09-11T10:20:18.789Z',
        level: 'warn',
        category: 'system',
        action: 'HIGH_CPU_USAGE',
        userId: null,
        userType: null,
        userName: null,
        ipAddress: '10.0.1.50',
        userAgent: 'System Monitor',
        details: 'CPU 사용률이 85%를 초과했습니다',
        requestId: null,
        responseTime: 0,
        statusCode: null,
        createdAt: '2024-09-11T10:20:18.789Z'
      },
      {
        id: 4,
        timestamp: '2024-09-11T10:15:22.012Z',
        level: 'info',
        category: 'expert',
        action: 'EXPERT_STATUS_CHANGE',
        userId: 1,
        userType: 'expert',
        userName: '이상담사',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        details: '전문가 상태를 "상담 가능"으로 변경',
        requestId: 'req_20240911_003',
        responseTime: 200,
        statusCode: 200,
        createdAt: '2024-09-11T10:15:22.012Z'
      },
      {
        id: 5,
        timestamp: '2024-09-11T10:10:15.345Z',
        level: 'debug',
        category: 'api',
        action: 'API_REQUEST',
        userId: 3,
        userType: 'client',
        userName: '정고객',
        ipAddress: '192.168.1.103',
        userAgent: 'ExpertLink Mobile App v1.2.0',
        details: 'GET /api/experts?category=psychology&available=true',
        requestId: 'req_20240911_004',
        responseTime: 120,
        statusCode: 200,
        createdAt: '2024-09-11T10:10:15.345Z'
      }
    ];

    return {
      data: mockLogs,
      total: mockLogs.length,
      page: 1,
      totalPages: 1
    };
  }

  async getSystemLogStats(startDate?: string, endDate?: string): Promise<any> {
    console.log('getSystemLogStats Mock 데이터 반환 중...');
    
    return {
      totalLogs: 1247,
      logsByLevel: {
        debug: 312,
        info: 684,
        warn: 187,
        error: 64
      },
      logsByCategory: {
        auth: 248,
        payment: 156,
        system: 89,
        user: 195,
        expert: 167,
        admin: 78,
        api: 203,
        database: 111
      },
      dailyStats: [
        { date: '2024-09-05', total: 156, error: 8, warn: 23 },
        { date: '2024-09-06', total: 189, error: 12, warn: 31 },
        { date: '2024-09-07', total: 203, error: 6, warn: 18 },
        { date: '2024-09-08', total: 174, error: 9, warn: 26 },
        { date: '2024-09-09', total: 145, error: 4, warn: 15 },
        { date: '2024-09-10', total: 198, error: 11, warn: 29 },
        { date: '2024-09-11', total: 182, error: 14, warn: 35 }
      ],
      topErrors: [
        { action: 'PAYMENT_FAILED', count: 23, percentage: 35.9 },
        { action: 'DATABASE_CONNECTION_ERROR', count: 15, percentage: 23.4 },
        { action: 'API_TIMEOUT', count: 12, percentage: 18.8 },
        { action: 'AUTHENTICATION_FAILED', count: 8, percentage: 12.5 },
        { action: 'VALIDATION_ERROR', count: 6, percentage: 9.4 }
      ]
    };
  }

  async getSystemLogById(id: number): Promise<any> {
    console.log('getSystemLogById 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { id };
  }

  async cleanupOldLogs(days: number, adminId: number, adminName: string, ip: string): Promise<any> {
    console.log('cleanupOldLogs 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { success: true, deletedCount: 0 };
  }

  async exportSystemLogs(query: any, adminId: number, adminName: string, ip: string): Promise<any> {
    console.log('exportSystemLogs 메서드가 호출되었습니다 - 통합 상담 시스템 마이그레이션 후 구현 필요');
    return { success: true, exportUrl: '' };
  }
}
