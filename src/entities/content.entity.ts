import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ContentLike } from './content-like.entity';
import { ContentBookmark } from './content-bookmark.entity';

export enum ContentType {
  ARTICLE = 'article',
  VIDEO = 'video',
  AUDIO = 'audio',
  INFOGRAPHIC = 'infographic',
  QUIZ = 'quiz',
  MEDITATION = 'meditation',
  EXERCISE = 'exercise'
}

export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum ContentCategory {
  DEPRESSION = 'depression',
  ANXIETY = 'anxiety',
  STRESS = 'stress',
  RELATIONSHIP = 'relationship',
  SELF_ESTEEM = 'self_esteem',
  SLEEP = 'sleep',
  ADDICTION = 'addiction',
  TRAUMA = 'trauma',
  PARENTING = 'parenting',
  WORKPLACE = 'workplace',
  GENERAL = 'general'
}

@Entity('contents')
export class Content {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  title: string;

  @Column('text')
  summary: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: ContentType,
    default: ContentType.ARTICLE
  })
  content_type: ContentType;

  @Column({
    type: 'enum',
    enum: ContentCategory,
    default: ContentCategory.GENERAL
  })
  category: ContentCategory;

  @Column({
    type: 'enum',
    enum: ContentStatus,
    default: ContentStatus.DRAFT
  })
  status: ContentStatus;

  @Column({ nullable: true })
  thumbnail_url: string;

  @Column({ nullable: true })
  media_url: string; // 비디오, 오디오, 이미지 URL

  @Column({ type: 'json', nullable: true })
  tags: string[]; // 태그 배열

  @Column({ type: 'int', default: 0 })
  reading_time: number; // 예상 읽기 시간 (분)

  @Column({ type: 'int', default: 0 })
  view_count: number;

  @Column({ type: 'int', default: 0 })
  like_count: number;

  @Column({ type: 'int', default: 0 })
  bookmark_count: number;

  @Column({ type: 'int', nullable: true })
  author_id: number; // 작성자 (전문가 또는 관리자)

  @Column({ length: 255, nullable: true })
  author_name: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // 추가 메타데이터 (퀴즈 정답, 명상 시간 등)

  @Column({ type: 'boolean', default: false })
  is_featured: boolean; // 추천 콘텐츠 여부

  @Column({ type: 'boolean', default: false })
  is_premium: boolean; // 프리미엄 콘텐츠 여부

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date;

  // Relations
  @OneToMany(() => ContentLike, contentLike => contentLike.content)
  likes: ContentLike[];

  @OneToMany(() => ContentBookmark, contentBookmark => contentBookmark.content)
  bookmarks: ContentBookmark[];
}