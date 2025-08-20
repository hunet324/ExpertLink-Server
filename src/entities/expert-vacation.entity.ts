import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ExpertProfile } from './expert-profile.entity';

export enum VacationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export enum VacationType {
  ANNUAL = 'annual',
  SICK = 'sick',
  PERSONAL = 'personal',
  EMERGENCY = 'emergency'
}

@Entity('expert_vacations')
export class ExpertVacation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  expert_id: number;

  @ManyToOne(() => ExpertProfile)
  @JoinColumn({ name: 'expert_id' })
  expert: ExpertProfile;

  @Column({ nullable: true })
  approved_by: number; // 승인자 ID (센터장 등)

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({
    type: 'enum',
    enum: VacationType,
    default: VacationType.ANNUAL
  })
  vacation_type: VacationType;

  @Column({
    type: 'enum',
    enum: VacationStatus,
    default: VacationStatus.PENDING
  })
  status: VacationStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}