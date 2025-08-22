import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { User, UserType, UserStatus } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { Counseling } from '../entities/counseling.entity';
import { Content } from '../entities/content.entity';
import { PsychTest } from '../entities/psych-test.entity';
import { PsychResult } from '../entities/psych-result.entity';
import { Notification } from '../entities/notification.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { AdminDashboardStatsDto } from './dto/admin-stats.dto';
import { AdminUserQueryDto, AdminUserListResponseDto, AdminUserDto, UserStatusUpdateDto, UserStatusUpdateResponseDto } from './dto/admin-user-management.dto';
import { ExpertVerificationDto, ExpertVerificationResponseDto, PendingExpertsListDto } from './dto/expert-verification.dto';
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
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
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
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.expertProfile', 'expert')
      .leftJoin('counselings', 'counseling', 'counseling.user_id = user.id OR counseling.expert_id = user.id')
      .leftJoin('contents', 'content', 'content.author_id = user.id')
      .leftJoin('psych_results', 'psych_result', 'psych_result.user_id = user.id')
      .addSelect('COUNT(DISTINCT counseling.id)', 'counseling_count')
      .addSelect('COUNT(DISTINCT content.id)', 'content_count')
      .addSelect('COUNT(DISTINCT psych_result.id)', 'psych_test_count')
      .groupBy('user.id')
      .addGroupBy('expert.id');

    // 필터링 적용
    this.applyUserFilters(queryBuilder, query);

    // 정렬 적용
    this.applyUserSorting(queryBuilder, query);

    // 전체 개수 조회
    const total = await queryBuilder.getCount();

    // 페이지네이션 적용
    const result = await queryBuilder
      .skip(query.offset)
      .take(query.limit)
      .getRawAndEntities();

    const users = result.entities.map((user, index) => {
      const raw = result.raw[index];
      const userDto = plainToClass(AdminUserDto, user, { excludeExtraneousValues: true });
      
      userDto.counseling_count = parseInt(raw.counseling_count) || 0;
      userDto.content_count = parseInt(raw.content_count) || 0;
      userDto.psych_test_count = parseInt(raw.psych_test_count) || 0;
      userDto.is_verified = user.expertProfile?.is_verified || false;
      
      return userDto;
    });

    const totalPages = Math.ceil(total / query.limit);

    return {
      users,
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
      this.counselingRepository.count({ where: { status: 'completed' as any } }),
      this.counselingRepository.count({ where: { status: 'pending' as any } }),
      this.counselingRepository.count({ where: { status: 'cancelled' as any } }),
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
    if (query.user_type) {
      queryBuilder.andWhere('user.user_type = :userType', { userType: query.user_type });
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
  }

  private applyUserSorting(queryBuilder: SelectQueryBuilder<User>, query: AdminUserQueryDto) {
    switch (query.sort_by) {
      case 'name':
        queryBuilder.orderBy('user.name', query.sort_order);
        break;
      case 'email':
        queryBuilder.orderBy('user.email', query.sort_order);
        break;
      case 'last_login':
        queryBuilder.orderBy('user.updated_at', query.sort_order); // 실제로는 last_login 필드
        break;
      case 'created_at':
      default:
        queryBuilder.orderBy('user.created_at', query.sort_order);
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
          years_experience: updateData.yearsExperience ? Number(updateData.yearsExperience) : undefined,
          hourly_rate: updateData.hourlyRate ? Number(updateData.hourlyRate) : undefined,
          license_type: updateData.licenseType,
          license_number: updateData.licenseNumber,
          center_id: updateData.centerId || updateData.center_id
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
}