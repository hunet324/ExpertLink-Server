import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PsychTest } from './psych-test.entity';
import { PsychQuestion } from './psych-question.entity';

export type ConditionType = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in_range';
export type ActionType = 'show_question' | 'hide_question' | 'jump_to_question' | 'end_survey' | 'show_message';

@Entity('logic_rules')
export class LogicRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'test_id', nullable: false })
  test_id: number;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'source_question_id', nullable: false })
  source_question_id: number;

  @Column({ type: 'jsonb' })
  condition: {
    type: ConditionType;
    value: string | number | string[] | { min: number; max: number };
    operator?: 'and' | 'or';
  };

  @Column({ type: 'jsonb' })
  action: {
    type: ActionType;
    target_question_id?: number;
    message?: string;
  };

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => PsychTest)
  @JoinColumn({ name: 'test_id' })
  test: PsychTest;

  @ManyToOne(() => PsychQuestion)
  @JoinColumn({ name: 'source_question_id' })
  source_question: PsychQuestion;
}