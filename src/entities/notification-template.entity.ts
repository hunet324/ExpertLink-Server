import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

export enum TemplateType {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  IN_APP = 'in_app'
}

export enum TemplateCategory {
  SYSTEM = 'system',
  COUNSELING = 'counseling',
  MARKETING = 'marketing',
  ADMIN = 'admin'
}

@Entity('notification_templates')
@Index(['is_active'])
@Index(['category'])
@Index(['type'])
export class NotificationTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  template_key: string;

  @Column({ length: 200 })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TemplateType
  })
  type: TemplateType;

  @Column({
    type: 'enum',
    enum: TemplateCategory
  })
  category: TemplateCategory;

  @Column('text')
  title_template: string;

  @Column('text')
  content_template: string;

  @Column('jsonb', { nullable: true })
  variables: Record<string, any>;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_system: boolean;

  @Column({ type: 'int', nullable: true })
  created_by: number;

  @Column({ type: 'int', nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater: User;
}