import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ExpertProfile } from './expert-profile.entity';

@Entity('centers')
export class Center {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, unique: true })
  code: string; // 센터 코드 (예: SEL001, BUS002)

  @Column({ type: 'text' })
  address: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ nullable: true })
  manager_id: number; // 센터장 ID

  @Column({ nullable: true })
  parent_center_id: number; // 상위 센터 ID (지역본부 등)

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToOne(() => User)
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @ManyToOne(() => Center, { nullable: true })
  @JoinColumn({ name: 'parent_center_id' })
  parentCenter: Center;

  @OneToMany(() => Center, center => center.parentCenter)
  subCenters: Center[];

  @OneToMany(() => User, user => user.center)
  staff: User[];

  @OneToMany(() => ExpertProfile, expert => expert.center)
  experts: ExpertProfile[];
}