import { 
  Controller, 
  Get, 
  Put, 
  Post, 
  Body, 
  UseGuards, 
  Req, 
  UseInterceptors, 
  UploadedFile,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { multerConfig } from '../common/config/multer.config';

@ApiTags('👤 users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ 
    summary: '👤 내 프로필 조회', 
    description: '현재 로그인한 사용자의 프로필 정보를 조회합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '프로필 조회 성공', 
    type: ProfileResponseDto 
  })
  @ApiResponse({ status: 401, description: '인증이 필요합니다.' })
  async getProfile(@Req() req: AuthenticatedRequest): Promise<ProfileResponseDto> {
    return await this.usersService.getProfile(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({ 
    summary: '✏️ 프로필 수정', 
    description: '사용자의 프로필 정보를 수정합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '프로필 수정 성공', 
    type: ProfileResponseDto 
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @ApiResponse({ status: 401, description: '인증이 필요합니다.' })
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return await this.usersService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('profile/image')
  @ApiOperation({ 
    summary: '📷 프로필 이미지 업로드', 
    description: '사용자의 프로필 이미지를 업로드합니다.' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '프로필 이미지 파일',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '이미지 파일 (JPG, PNG, GIF 지원)',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: '이미지 업로드 성공', 
    type: ProfileResponseDto 
  })
  @ApiResponse({ status: 400, description: '이미지 파일이 필요합니다.' })
  @ApiResponse({ status: 401, description: '인증이 필요합니다.' })
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadProfileImage(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    if (!file) {
      throw new Error('이미지 파일이 필요합니다.');
    }

    // 파일 URL 생성 (실제 환경에서는 CDN URL 등을 사용)
    const imageUrl = `/uploads/profiles/${file.filename}`;
    
    return await this.usersService.updateProfileImage(req.user.userId, imageUrl);
  }
}