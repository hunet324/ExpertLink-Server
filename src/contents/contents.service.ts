import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Content, ContentStatus } from '../entities/content.entity';
import { ContentLike } from '../entities/content-like.entity';
import { ContentBookmark } from '../entities/content-bookmark.entity';
import { ContentResponseDto, ContentListResponseDto } from './dto/content-response.dto';
import { ContentQueryDto } from './dto/content-query.dto';
import { ContentLikeResponseDto, ContentBookmarkResponseDto } from './dto/content-interaction.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ContentsService {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(ContentLike)
    private contentLikeRepository: Repository<ContentLike>,
    @InjectRepository(ContentBookmark)
    private contentBookmarkRepository: Repository<ContentBookmark>,
  ) {}

  async getContents(query: ContentQueryDto, userId?: number): Promise<{
    contents: ContentListResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const queryBuilder = this.contentRepository
      .createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED });

    // 필터링 적용
    this.applyFilters(queryBuilder, query);

    // 정렬 적용
    this.applySorting(queryBuilder, query.sort_by);

    // 전체 개수 조회
    const total = await queryBuilder.getCount();

    // 페이지네이션 적용
    const contents = await queryBuilder
      .skip(query.offset)
      .take(query.limit)
      .getMany();

    // 사용자별 상호작용 정보 추가
    const contentsWithInteractions = await this.addUserInteractions(contents, userId);

    const totalPages = Math.ceil(total / query.limit);

    return {
      contents: contentsWithInteractions.map(content =>
        plainToClass(ContentListResponseDto, content, { excludeExtraneousValues: true })
      ),
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
    };
  }

  async getContentById(contentId: number, userId?: number): Promise<ContentResponseDto> {
    const content = await this.contentRepository.findOne({
      where: {
        id: contentId,
        status: ContentStatus.PUBLISHED,
      },
    });

    if (!content) {
      throw new NotFoundException('콘텐츠를 찾을 수 없습니다.');
    }

    // 조회수 증가
    await this.incrementViewCount(contentId);

    // 사용자 상호작용 정보 추가
    const contentWithInteraction = await this.addUserInteractions([content], userId);

    return plainToClass(ContentResponseDto, contentWithInteraction[0], {
      excludeExtraneousValues: true,
    });
  }

  async likeContent(contentId: number, userId: number): Promise<ContentLikeResponseDto> {
    const content = await this.contentRepository.findOne({
      where: { id: contentId, status: ContentStatus.PUBLISHED },
    });

    if (!content) {
      throw new NotFoundException('콘텐츠를 찾을 수 없습니다.');
    }

    const existingLike = await this.contentLikeRepository.findOne({
      where: { content_id: contentId, user_id: userId },
    });

    let isLiked: boolean;
    let message: string;

    if (existingLike) {
      // 좋아요 취소
      await this.contentLikeRepository.remove(existingLike);
      await this.contentRepository.decrement({ id: contentId }, 'like_count', 1);
      isLiked = false;
      message = '좋아요를 취소했습니다.';
    } else {
      // 좋아요 추가
      const newLike = this.contentLikeRepository.create({
        content_id: contentId,
        user_id: userId,
      });
      await this.contentLikeRepository.save(newLike);
      await this.contentRepository.increment({ id: contentId }, 'like_count', 1);
      isLiked = true;
      message = '좋아요를 눌렀습니다.';
    }

    // 업데이트된 좋아요 수 조회
    const updatedContent = await this.contentRepository.findOne({
      where: { id: contentId },
      select: ['like_count'],
    });

    return {
      message,
      isLiked,
      likeCount: updatedContent.like_count,
    };
  }

  async bookmarkContent(contentId: number, userId: number): Promise<ContentBookmarkResponseDto> {
    const content = await this.contentRepository.findOne({
      where: { id: contentId, status: ContentStatus.PUBLISHED },
    });

    if (!content) {
      throw new NotFoundException('콘텐츠를 찾을 수 없습니다.');
    }

    const existingBookmark = await this.contentBookmarkRepository.findOne({
      where: { content_id: contentId, user_id: userId },
    });

    let isBookmarked: boolean;
    let message: string;

    if (existingBookmark) {
      // 북마크 취소
      await this.contentBookmarkRepository.remove(existingBookmark);
      await this.contentRepository.decrement({ id: contentId }, 'bookmark_count', 1);
      isBookmarked = false;
      message = '북마크를 취소했습니다.';
    } else {
      // 북마크 추가
      const newBookmark = this.contentBookmarkRepository.create({
        content_id: contentId,
        user_id: userId,
      });
      await this.contentBookmarkRepository.save(newBookmark);
      await this.contentRepository.increment({ id: contentId }, 'bookmark_count', 1);
      isBookmarked = true;
      message = '북마크에 추가했습니다.';
    }

    // 업데이트된 북마크 수 조회
    const updatedContent = await this.contentRepository.findOne({
      where: { id: contentId },
      select: ['bookmark_count'],
    });

    return {
      message,
      isBookmarked,
      bookmarkCount: updatedContent.bookmark_count,
    };
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Content>, query: ContentQueryDto) {
    if (query.content_type) {
      queryBuilder.andWhere('content.content_type = :contentType', {
        contentType: query.content_type,
      });
    }

    if (query.category) {
      queryBuilder.andWhere('content.category = :category', {
        category: query.category,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(content.title ILIKE :search OR content.summary ILIKE :search OR content.tags::text ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    if (query.is_featured !== undefined) {
      queryBuilder.andWhere('content.is_featured = :isFeatured', {
        isFeatured: query.is_featured,
      });
    }

    if (query.is_premium !== undefined) {
      queryBuilder.andWhere('content.is_premium = :isPremium', {
        isPremium: query.is_premium,
      });
    }

    if (query.tagArray && query.tagArray.length > 0) {
      queryBuilder.andWhere('content.tags ?| ARRAY[:...tags]', {
        tags: query.tagArray,
      });
    }
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Content>, sortBy: string) {
    switch (sortBy) {
      case 'popular':
        queryBuilder.orderBy('content.like_count', 'DESC');
        break;
      case 'views':
        queryBuilder.orderBy('content.view_count', 'DESC');
        break;
      case 'likes':
        queryBuilder.orderBy('content.like_count', 'DESC');
        break;
      case 'latest':
      default:
        queryBuilder.orderBy('content.published_at', 'DESC');
        break;
    }
  }

  private async addUserInteractions(contents: Content[], userId?: number): Promise<Content[]> {
    if (!userId || contents.length === 0) {
      return contents.map(content => ({
        ...content,
        is_liked: false,
        is_bookmarked: false,
      }));
    }

    const contentIds = contents.map(content => content.id);

    // 사용자의 좋아요 정보 조회
    const userLikes = await this.contentLikeRepository.find({
      where: {
        content_id: contentIds.length === 1 ? contentIds[0] : contentIds as any,
        user_id: userId,
      },
      select: ['content_id'],
    });

    // 사용자의 북마크 정보 조회
    const userBookmarks = await this.contentBookmarkRepository.find({
      where: {
        content_id: contentIds.length === 1 ? contentIds[0] : contentIds as any,
        user_id: userId,
      },
      select: ['content_id'],
    });

    const likedContentIds = new Set(userLikes.map(like => like.content_id));
    const bookmarkedContentIds = new Set(userBookmarks.map(bookmark => bookmark.content_id));

    return contents.map(content => ({
      ...content,
      is_liked: likedContentIds.has(content.id),
      is_bookmarked: bookmarkedContentIds.has(content.id),
    }));
  }

  private async incrementViewCount(contentId: number): Promise<void> {
    await this.contentRepository.increment({ id: contentId }, 'view_count', 1);
  }
}