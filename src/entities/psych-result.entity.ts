import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PsychTest } from './psych-test.entity';
import { User } from './user.entity';

interface ResultDetails {
  scores: Record<string, number>; // 세부 점수들
  categories: Record<string, any>; // 카테고리별 결과
  recommendations: string[]; // 추천사항
  [key: string]: any;
}

@Entity('psych_results')
@Index(['user_id', 'test_id'], { unique: true })
export class PsychResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int' })
  test_id: number;

  @Column({ type: 'int', nullable: true })
  total_score: number;

  @Column({ length: 100, nullable: true })
  result_type: string; // ISFP, 경도 우울, 높음 등

  @Column('text', { nullable: true })
  result_description: string;

  @Column({ type: 'jsonb', nullable: true })
  result_details: ResultDetails;

  @CreateDateColumn()
  completed_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PsychTest, test => test.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test: PsychTest;
}