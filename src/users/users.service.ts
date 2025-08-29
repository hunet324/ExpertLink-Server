import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserType, UserStatus } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ExpertProfile)
    private expertProfileRepository: Repository<ExpertProfile>,
    private dataSource: DataSource,
  ) {}

  async create(registerDto: RegisterDto): Promise<User> {
    const { email, password, ...userData } = registerDto;

    // 이메일 중복 확인
    const existingUser = await this.usersRepository.findOne({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 12);

    // 사용자 생성 - 전문가만 PENDING, 일반 회원과 관리자는 ACTIVE
    const userStatus = userData.user_type === UserType.EXPERT 
      ? UserStatus.PENDING 
      : UserStatus.ACTIVE;

    // 트랜잭션으로 User와 ExpertProfile 동시 생성
    return await this.dataSource.transaction(async manager => {
      const user = manager.create(User, {
        ...userData,
        email,
        password_hash: hashedPassword,
        status: userStatus,
      });

      const savedUser = await manager.save(User, user);

      // 전문가인 경우 빈 ExpertProfile 생성
      if (userData.user_type === UserType.EXPERT) {
        const expertProfile = manager.create(ExpertProfile, {
          user_id: savedUser.id,
          specialization: [],
          is_verified: false,
          // 다른 필드들은 기본값 또는 null로 설정됨
        });

        await manager.save(ExpertProfile, expertProfile);
      }

      return savedUser;
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { email }
    });
  }

  async findById(id: number): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { id }
    });
  }

  async getProfile(userId: number): Promise<ProfileResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return plainToClass(ProfileResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 업데이트할 필드만 적용
    Object.assign(user, updateProfileDto);
    
    const updatedUser = await this.usersRepository.save(user);

    return plainToClass(ProfileResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });
  }

  async updateProfileImage(userId: number, imageUrl: string): Promise<ProfileResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    user.profile_image = imageUrl;
    const updatedUser = await this.usersRepository.save(user);

    return plainToClass(ProfileResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 현재 비밀번호 검증
    const isCurrentPasswordValid = await this.validatePassword(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      throw new ConflictException('현재 비밀번호가 올바르지 않습니다.');
    }

    // 새 비밀번호와 현재 비밀번호가 같은지 확인
    const isSamePassword = await this.validatePassword(newPassword, user.password_hash);
    if (isSamePassword) {
      throw new ConflictException('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
    }

    // 새 비밀번호 해시화
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // 비밀번호 업데이트
    await this.usersRepository.update(userId, {
      password_hash: hashedNewPassword,
      last_password_change: new Date(),
      password_change_required: false,
      updated_at: new Date()
    });
  }

  async getPasswordInfo(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const now = new Date();
    const lastPasswordChange = user.last_password_change || user.created_at;
    const daysSinceLastChange = Math.ceil((now.getTime() - lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24));
    const isPasswordExpiringSoon = daysSinceLastChange > 60; // 60일 이후 경고

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: this.getUserRoleLabel(user.user_type),
      lastPasswordChange: lastPasswordChange.toISOString(),
      loginCount: user.login_count || 0,
      lastLogin: user.last_login?.toISOString(),
      daysSinceLastChange,
      isPasswordExpiringSoon
    };
  }

  private getUserRoleLabel(userType: UserType): string {
    const roleLabels = {
      [UserType.SUPER_ADMIN]: '최고 관리자',
      [UserType.REGIONAL_MANAGER]: '지역 관리자',
      [UserType.CENTER_MANAGER]: '센터 관리자',
      [UserType.STAFF]: '일반 직원',
      [UserType.EXPERT]: '전문가',
      [UserType.GENERAL]: '일반 사용자'
    };
    return roleLabels[userType] || userType;
  }

  async updateLoginInfo(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      last_login: new Date(),
      login_count: () => 'login_count + 1',
      login_attempts: 0 // 성공적인 로그인 시 시도 횟수 초기화
    });
  }
}