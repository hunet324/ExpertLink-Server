import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  COUNSELING = 'counseling',
  SCHEDULE = 'schedule', 
  CONTENT = 'content',
  SYSTEM = 'system',
  CHAT = 'chat',
  PSYCH_TEST = 'psych_test'
}

@Entity('notifications')
@Index(['user_id', 'is_read'])
@Index(['user_id', 'created_at'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ length: 200, nullable: true })
  title: string;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    nullable: true
  })
  type: NotificationType;

  @Column({ type: 'int', nullable: true })
  reference_id: number; // 관련된 테이블의 ID (counseling_id, content_id 등)

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // 추가 데이터 (링크, 이미지 등)

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}