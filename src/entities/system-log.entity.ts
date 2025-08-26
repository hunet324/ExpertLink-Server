import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export enum LogCategory {
  AUTH = 'auth',
  PAYMENT = 'payment',
  SYSTEM = 'system',
  USER = 'user',
  EXPERT = 'expert',
  ADMIN = 'admin',
  API = 'api',
  DATABASE = 'database',
}

@Entity('system_logs')
@Index('idx_system_logs_timestamp', ['timestamp'])
@Index('idx_system_logs_level', ['level'])
@Index('idx_system_logs_category', ['category'])
@Index('idx_system_logs_user_id', ['userId'])
export class SystemLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: LogLevel,
    default: LogLevel.INFO,
  })
  level: LogLevel;

  @Column({
    type: 'enum',
    enum: LogCategory,
  })
  category: LogCategory;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId?: number;

  @Column({ name: 'user_type', type: 'varchar', length: 20, nullable: true })
  userType?: string;

  @Column({ name: 'user_name', type: 'varchar', length: 100, nullable: true })
  userName?: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'text' })
  details: string;

  @Column({ name: 'request_id', type: 'varchar', length: 50, nullable: true })
  requestId?: string;

  @Column({ name: 'response_time', type: 'int', nullable: true })
  responseTime?: number;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode?: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}