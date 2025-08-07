import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PsychQuestion } from './psych-question.entity';
import { User } from './user.entity';

@Entity('psych_answers')
@Index(['user_id', 'question_id'], { unique: true })
export class PsychAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int' })
  question_id: number;

  @Column({ length: 500 })
  answer_value: string;

  @Column({ type: 'int', nullable: true })
  score: number; // 해당 답변의 점수

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PsychQuestion, question => question.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: PsychQuestion;
}