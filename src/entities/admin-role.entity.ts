import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';
import { AdminPermission } from './admin-permission.entity';

@Entity('admin_roles')
export class AdminRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  role_code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 20, default: 'bg-primary' })
  color: string;

  @Column({ default: false })
  is_system: boolean;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => RolePermission, rolePermission => rolePermission.role)
  role_permissions?: RolePermission[];

  @OneToMany(() => UserRole, userRole => userRole.role)
  user_roles?: UserRole[];

  @ManyToMany(() => AdminPermission)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' }
  })
  permissions?: AdminPermission[];
}