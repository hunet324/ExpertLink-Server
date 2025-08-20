import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserType {
  GENERAL = 'general',
  EXPERT = 'expert',
  STAFF = 'staff',
  CENTER_MANAGER = 'center_manager',
  REGIONAL_MANAGER = 'regional_manager',
  SUPER_ADMIN = 'super_admin'
}

export enum AdminLevel {
  STAFF = 'staff',
  CENTER_MANAGER = 'center_manager',
  REGIONAL_MANAGER = 'regional_manager',
  SUPER_ADMIN = 'super_admin'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  WITHDRAWN = 'withdrawn'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  @Exclude()
  password_hash: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: UserType,
    default: UserType.GENERAL
  })
  user_type: UserType;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING
  })
  status: UserStatus;

  @Column({ length: 500, nullable: true })
  profile_image: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @CreateDateColumn()
  signup_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // New fields for organization structure
  @Column({ nullable: true })
  center_id: number; // 소속 센터

  @Column({
    type: 'enum',
    enum: AdminLevel,
    nullable: true
  })
  admin_level: AdminLevel; // 관리자 등급

  @Column({ length: 100, nullable: true })
  department: string; // 부서

  @Column({ length: 100, nullable: true })
  position: string; // 직책

  @Column({ nullable: true })
  supervisor_id: number; // 상급자 ID

  // Relations
  @OneToOne('ExpertProfile', 'user')
  expertProfile?: any;

  @ManyToOne('Center', 'staff', { nullable: true })
  @JoinColumn({ name: 'center_id' })
  center?: any;

  @ManyToOne(() => User, user => user.subordinates, { nullable: true })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor?: User;

  @OneToMany(() => User, user => user.supervisor)
  subordinates?: User[];
}