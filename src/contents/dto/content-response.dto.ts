import { Expose, Type } from 'class-transformer';
import { ContentType, ContentCategory, ContentStatus } from '../../entities/content.entity';

export class ContentResponseDto {
  @Expose()
  id: number;

  @Expose()
  title: string;

  @Expose()
  summary: string;

  @Expose()
  content: string;

  @Expose()
  content_type: ContentType;

  @Expose()
  category: ContentCategory;

  @Expose()
  status: ContentStatus;

  @Expose()
  thumbnail_url: string;

  @Expose()
  media_url: string;

  @Expose()
  tags: string[];

  @Expose()
  reading_time: number;

  @Expose()
  view_count: number;

  @Expose()
  like_count: number;

  @Expose()
  bookmark_count: number;

  @Expose()
  author_id: number;

  @Expose()
  author_name: string;

  @Expose()
  metadata: Record<string, any>;

  @Expose()
  is_featured: boolean;

  @Expose()
  is_premium: boolean;

  @Expose()
  @Type(() => Date)
  published_at: Date;

  @Expose()
  @Type(() => Date)
  created_at: Date;

  @Expose()
  @Type(() => Date)
  updated_at: Date;

  // 사용자별 상호작용 정보 (옵셔널)
  @Expose()
  is_liked?: boolean;

  @Expose()
  is_bookmarked?: boolean;
}

export class ContentListResponseDto {
  @Expose()
  id: number;

  @Expose()
  title: string;

  @Expose()
  summary: string;

  @Expose()
  content_type: ContentType;

  @Expose()
  category: ContentCategory;

  @Expose()
  thumbnail_url: string;

  @Expose()
  tags: string[];

  @Expose()
  reading_time: number;

  @Expose()
  view_count: number;

  @Expose()
  like_count: number;

  @Expose()
  bookmark_count: number;

  @Expose()
  author_name: string;

  @Expose()
  is_featured: boolean;

  @Expose()
  is_premium: boolean;

  @Expose()
  @Type(() => Date)
  published_at: Date;

  @Expose()
  is_liked?: boolean;

  @Expose()
  is_bookmarked?: boolean;
}