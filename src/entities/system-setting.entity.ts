import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SettingValueType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  TEXTAREA = 'textarea'
}

export enum SettingCategory {
  GENERAL = 'general',
  USER = 'user',
  PAYMENT = 'payment',
  CONSULTATION = 'consultation',
  NOTIFICATION = 'notification',
  SECURITY = 'security'
}

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: SettingCategory
  })
  category: SettingCategory;

  @Column({ length: 100 })
  key: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: SettingValueType
  })
  value_type: SettingValueType;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'text' })
  default_value: string;

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  validation_rules: {
    min?: number;
    max?: number;
  } | null;

  @Column({ default: false })
  is_required: boolean;

  @Column({ default: false })
  is_public: boolean;

  @Column({ length: 20, nullable: true })
  unit: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}