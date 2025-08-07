import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Schedule } from './schedule.entity';

export enum CounselingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

@Entity('counselings')
export class Counseling {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  expert_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'expert_id' })
  expert: User;

  @Column({ nullable: true })
  schedule_id: number;

  @ManyToOne(() => Schedule)
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @CreateDateColumn()
  request_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  appointment_date: Date;

  @Column({
    type: 'enum',
    enum: CounselingStatus,
    default: CounselingStatus.PENDING
  })
  status: CounselingStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  session_notes: string;

  @Column({ type: 'text', nullable: true })
  user_feedback: string;

  @Column({ type: 'int', nullable: true })
  rating: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  payment_amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  payment_status: PaymentStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}