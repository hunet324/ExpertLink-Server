import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ExpertProfile } from './expert-profile.entity';

export enum CounselingStatus {
  AVAILABLE = 'available',       // 예약 가능한 슬롯
  PENDING = 'pending',           // 상담 신청, 승인 대기
  SCHEDULE_PROPOSED = 'schedule_proposed', // 전문가가 일정을 제안한 상태
  APPROVED = 'approved',         // 상담 확정
  IN_PROGRESS = 'in_progress',   // 상담 진행 중
  COMPLETED = 'completed',       // 상담 완료
  CANCELLED = 'cancelled',       // 상담 취소
  REJECTED = 'rejected'          // 전문가 거절
}

export enum CounselingType {
  VIDEO = 'video',
  CHAT = 'chat',
  VOICE = 'voice'
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

  @Column({ nullable: true })
  user_id: number;  // NULL이면 가용 슬롯

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  expert_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'expert_id' })
  expert: User;

  @ManyToOne(() => ExpertProfile)
  @JoinColumn({ name: 'expert_id' })
  expertProfile: ExpertProfile;

  // 일정 정보 (기존 schedules 필드들 통합)
  @Column({ type: 'date', nullable: true })
  schedule_date: string;

  @Column({ type: 'time', nullable: true })
  start_time: string;

  @Column({ type: 'time', nullable: true })
  end_time: string;

  @Column({ default: 60 })
  duration: number;

  @Column({ length: 200, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

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

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: CounselingType,
    default: CounselingType.VIDEO
  })
  type: CounselingType;

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

  // 실제 상담 시간 추적
  @Column({ type: 'timestamp', nullable: true })
  actual_start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  actual_end_time: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // 유틸리티 메서드들
  isAvailableSlot(): boolean {
    return this.user_id === null && this.status === CounselingStatus.AVAILABLE;
  }

  isBookedSession(): boolean {
    return this.user_id !== null;
  }

  isActiveSession(): boolean {
    const now = new Date();
    const sessionStart = new Date(`${this.schedule_date}T${this.start_time}`);
    const sessionEnd = new Date(`${this.schedule_date}T${this.end_time}`);
    
    return now >= sessionStart && now <= sessionEnd && 
           this.status === CounselingStatus.IN_PROGRESS;
  }

  canBeCancelled(): boolean {
    return [
      CounselingStatus.PENDING,
      CounselingStatus.APPROVED
    ].includes(this.status);
  }

  canBeModified(): boolean {
    return [
      CounselingStatus.AVAILABLE,
      CounselingStatus.PENDING
    ].includes(this.status);
  }
}