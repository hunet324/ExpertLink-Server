import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  ) {}

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
    const experts = await this.expertProfileRepository.find({
      where: { is_verified: false },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });

    const pendingExperts = experts.map(expert => ({
      id: expert.id,
      user_id: expert.user_id,
      user_name: expert.user.name,
      user_email: expert.user.email,
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
    }));

    return {
      experts: pendingExperts,
      total: experts.length,
      pending_count: experts.length,
    };
  }

  async verifyExpert(expertId: number, verificationDto: ExpertVerificationDto, adminId: number): Promise<ExpertVerificationResponseDto> {
    const expertProfile = await this.expertProfileRepository.findOne({
      where: { id: expertId },
      relations: ['user'],
    });

    if (!expertProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    expertProfile.is_verified = verificationDto.is_verified;
    expertProfile.verification_date = new Date();

    await this.expertProfileRepository.save(expertProfile);

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
      expert_id: expertId,
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
}