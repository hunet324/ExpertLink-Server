import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PsychQuestion } from './psych-question.entity';
import { PsychResult } from './psych-result.entity';

export enum TestLogicType {
  MBTI = 'mbti',
  SCALE = 'scale', // 점수 기반 (우울, 불안 척도 등)
  CATEGORY = 'category' // 카테고리 분류
}

@Entity('psych_tests')
export class PsychTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TestLogicType
  })
  logic_type: TestLogicType;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', nullable: true })
  max_score: number;

  @Column({ type: 'int', default: 0 })
  estimated_time: number; // 예상 소요 시간 (분)

  @Column({ type: 'text', nullable: true })
  instruction: string; // 설문 시작 전 안내사항

  @Column({ type: 'json', nullable: true })
  scoring_rules: Record<string, any>; // 점수 계산 규칙

  @Column({ type: 'json', nullable: true })
  result_ranges: Record<string, any>; // 결과 구간 정의

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => PsychQuestion, question => question.test, { cascade: true })
  questions: PsychQuestion[];

  @OneToMany(() => PsychResult, result => result.test)
  results: PsychResult[];
}