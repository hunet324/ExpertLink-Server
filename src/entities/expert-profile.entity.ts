import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity('expert_profiles')
export class ExpertProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  user_id: number;

  @OneToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('text', { array: true, default: [] })
  specialization: string[];

  @Column({ length: 50, nullable: true })
  license_number: string;

  @Column({ length: 50, nullable: true })
  license_type: string;

  @Column({ type: 'int', nullable: true })
  years_experience: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hourly_rate: number;

  @Column({ type: 'text', nullable: true })
  introduction: string;

  @Column({ type: 'text', nullable: true })
  education: string;

  @Column({ type: 'text', nullable: true })
  career_history: string;

  @Column('text', { array: true, default: [], nullable: true })
  certifications: string[];

  @Column({ type: 'jsonb', default: {}, nullable: true })
  available_hours: object;

  @Column({ type: 'jsonb', default: { video: true, chat: true, voice: true }, nullable: true })
  consultation_settings: object;

  @Column({ type: 'jsonb', default: { video: 0, chat: 0, voice: 0 }, nullable: true })
  pricing_settings: object;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verification_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // New fields for organization structure
  @Column({ nullable: true })
  center_id: number; // 소속 센터

  @Column({ nullable: true })
  assigned_manager_id: number; // 담당 관리자

  // New Relations
  @ManyToOne('Center', 'experts', { nullable: true })
  @JoinColumn({ name: 'center_id' })
  center?: any;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_manager_id' })
  assignedManager?: User;
}