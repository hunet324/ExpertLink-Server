import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { AdminRole } from './admin-role.entity';
import { AdminPermission } from './admin-permission.entity';
import { User } from './user.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  role_id: number;

  @Column()
  permission_id: number;

  @CreateDateColumn()
  granted_at: Date;

  @Column({ nullable: true })
  granted_by: number;

  // Relations
  @ManyToOne(() => AdminRole, role => role.role_permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: AdminRole;

  @ManyToOne(() => AdminPermission, permission => permission.role_permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: AdminPermission;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'granted_by' })
  granter?: User;
}