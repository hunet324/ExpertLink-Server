import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ContentsService } from './contents.service';
import { ContentQueryDto } from './dto/content-query.dto';
import { ContentResponseDto, ContentListResponseDto } from './dto/content-response.dto';
import { ContentLikeResponseDto, ContentBookmarkResponseDto } from './dto/content-interaction.dto';

interface RequestWithUser {
  user?: {
    userId: number;
    email: string;
    userType: string;
  };
}

@ApiTags('📚 contents')
@Controller('contents')
export class ContentsController {
  constructor(private readonly contentsService: ContentsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard) // 비로그인 사용자도 접근 가능
  async getContents(
    @Query() query: ContentQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<{
    contents: ContentListResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const userId = req.user?.userId;
    return await this.contentsService.getContents(query, userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard) // 비로그인 사용자도 접근 가능
  async getContentById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<ContentResponseDto> {
    const userId = req.user?.userId;
    return await this.contentsService.getContentById(id, userId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard) // 로그인 필수
  @HttpCode(HttpStatus.OK)
  async likeContent(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<ContentLikeResponseDto> {
    const userId = req.user.userId;
    return await this.contentsService.likeContent(id, userId);
  }

  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard) // 로그인 필수
  @HttpCode(HttpStatus.OK)
  async bookmarkContent(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<ContentBookmarkResponseDto> {
    const userId = req.user.userId;
    return await this.contentsService.bookmarkContent(id, userId);
  }
}