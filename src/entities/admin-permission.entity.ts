import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { AdminRole } from './admin-role.entity';

@Entity('admin_permissions')
export class AdminPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  permission_code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50 })
  category: string;

  @Column({ length: 50 })
  resource: string;

  @Column('text', { array: true })
  actions: string[];

  @Column({ default: false })
  is_system: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => RolePermission, rolePermission => rolePermission.permission)
  role_permissions?: RolePermission[];

  @ManyToMany(() => AdminRole, role => role.permissions)
  roles?: AdminRole[];
}