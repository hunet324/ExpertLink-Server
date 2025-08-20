import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { ExpertProfile } from './expert-profile.entity';

export enum WorkStatus {
  STARTED = 'started',
  BREAK = 'break',
  RESUMED = 'resumed',
  FINISHED = 'finished'
}

@Entity('work_logs')
@Unique(['expert_id', 'work_date', 'status', 'logged_at'])
export class WorkLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  expert_id: number;

  @ManyToOne(() => ExpertProfile)
  @JoinColumn({ name: 'expert_id' })
  expert: ExpertProfile;

  @Column({ type: 'date' })
  work_date: Date;

  @Column({
    type: 'enum',
    enum: WorkStatus
  })
  status: WorkStatus;

  @Column({ type: 'timestamp' })
  logged_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  location: string; // 근무 위치

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}