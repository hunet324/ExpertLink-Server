import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminDashboardStatsDto } from './dto/admin-stats.dto';
import { AdminUserQueryDto, AdminUserListResponseDto, UserStatusUpdateDto, UserStatusUpdateResponseDto } from './dto/admin-user-management.dto';
import { ExpertVerificationDto, ExpertVerificationResponseDto, PendingExpertsListDto } from './dto/expert-verification.dto';

import { CreateInitialAdminDto } from './dto/create-initial-admin.dto';

interface RequestWithUser {
  user: {
    userId: number;
    email: string;
    userType: string;
  };
}

@ApiTags('⚙️ admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('initial-admin')
  @HttpCode(HttpStatus.CREATED)
  async createInitialAdmin(@Body() createDto: CreateInitialAdminDto): Promise<any> {
    return await this.adminService.createInitialAdmin(createDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard) // JWT 인증 + 관리자 권한 필요
  @Get('stats')
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    return await this.adminService.getDashboardStats();
  }

  @Get('users')
  async getUsers(@Query() query: AdminUserQueryDto): Promise<AdminUserListResponseDto> {
    return await this.adminService.getUsers(query);
  }

  @Put('users/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateDto: UserStatusUpdateDto,
    @Req() req: RequestWithUser,
  ): Promise<UserStatusUpdateResponseDto> {
    const adminId = req.user.userId;
    return await this.adminService.updateUserStatus(userId, updateDto, adminId);
  }

  @Get('experts/pending')
  async getPendingExperts(): Promise<PendingExpertsListDto> {
    return await this.adminService.getPendingExperts();
  }

  @Put('experts/:id/verify')
  @HttpCode(HttpStatus.OK)
  async verifyExpert(
    @Param('id', ParseIntPipe) expertId: number,
    @Body() verificationDto: ExpertVerificationDto,
    @Req() req: RequestWithUser,
  ): Promise<ExpertVerificationResponseDto> {
    const adminId = req.user.userId;
    return await this.adminService.verifyExpert(expertId, verificationDto, adminId);
  }
}