import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ExpertProfile } from './expert-profile.entity';
import { Counseling } from './counseling.entity';

export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'card' | 'bank' | 'kakao' | 'paypal';
export type ServiceType = 'video' | 'chat' | 'voice' | 'test';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'transaction_id', unique: true, length: 100 })
  transaction_id: string;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'expert_id' })
  expert_id: number;

  @Column({ name: 'counseling_id', nullable: true })
  counseling_id: number;

  @Column({ 
    type: 'enum',
    enum: ['video', 'chat', 'voice', 'test'],
    name: 'service_type'
  })
  service_type: ServiceType;

  @Column({ name: 'service_name', length: 200 })
  service_name: string;

  @Column({ type: 'int', name: 'amount' })
  amount: number;

  @Column({ type: 'int', name: 'fee' })
  fee: number;

  @Column({ type: 'int', name: 'net_amount' })
  net_amount: number;

  @Column({ 
    type: 'enum',
    enum: ['card', 'bank', 'kakao', 'paypal'],
    name: 'payment_method'
  })
  payment_method: PaymentMethod;

  @Column({ name: 'payment_provider', length: 100 })
  payment_provider: string;

  @Column({ 
    type: 'enum',
    enum: ['completed', 'pending', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  })
  status: PaymentStatus;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paid_at: Date;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refunded_at: Date;

  @Column({ name: 'refund_reason', type: 'text', nullable: true })
  refund_reason: string;

  @Column({ name: 'session_duration', type: 'int', nullable: true })
  session_duration: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'receipt_url', type: 'text', nullable: true })
  receipt_url: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ExpertProfile)
  @JoinColumn({ name: 'expert_id' })
  expert: ExpertProfile;

  @ManyToOne(() => Counseling, { nullable: true })
  @JoinColumn({ name: 'counseling_id' })
  counseling: Counseling;
}