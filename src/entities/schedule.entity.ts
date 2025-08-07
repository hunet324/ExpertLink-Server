import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';

export enum ScheduleStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

@Entity('schedules')
@Unique(['expert_id', 'schedule_date', 'start_time'])
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  expert_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'expert_id' })
  expert: User;

  @Column({ length: 200, nullable: true })
  title: string;

  @Column({ type: 'date' })
  schedule_date: Date;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.AVAILABLE
  })
  status: ScheduleStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}