import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { PsychTest } from './psych-test.entity';
import { PsychAnswer } from './psych-answer.entity';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  SCALE = 'scale', // 1-5, 1-7 척도
  TEXT = 'text',
  YES_NO = 'yes_no'
}

interface QuestionOption {
  value: string | number;
  text: string;
  score?: number; // 해당 선택지의 점수
}

@Entity('psych_questions')
export class PsychQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  test_id: number;

  @Column('text')
  question: string;

  @Column({ type: 'int' })
  question_order: number;

  @Column({
    type: 'enum',
    enum: QuestionType,
    default: QuestionType.MULTIPLE_CHOICE
  })
  question_type: QuestionType;

  @Column({ type: 'jsonb', nullable: true })
  options: QuestionOption[]; // 선택지 정보

  @Column({ type: 'boolean', default: true })
  is_required: boolean;

  @Column({ type: 'text', nullable: true })
  help_text: string; // 문항 설명

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => PsychTest, test => test.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test: PsychTest;

  @OneToMany(() => PsychAnswer, answer => answer.question)
  answers: PsychAnswer[];
}