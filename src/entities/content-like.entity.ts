import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Content } from './content.entity';
import { User } from './user.entity';

@Entity('content_likes')
@Index(['content_id', 'user_id'], { unique: true }) // 사용자당 콘텐츠 하나에 대해 하나의 좋아요만 가능
export class ContentLike {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  content_id: number;

  @Column({ type: 'int' })
  user_id: number;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Content, content => content.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}