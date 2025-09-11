import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionService } from './services/permission.service';
import { SystemLogService } from './services/system-log.service';
import { CacheService } from './services/cache.service';
import { AdminRole } from '../entities/admin-role.entity';
import { AdminPermission } from '../entities/admin-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';
import { SystemLog } from '../entities/system-log.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminRole,
      AdminPermission,
      UserRole,
      User,
      SystemLog
    ])
  ],
  providers: [PermissionService, SystemLogService, CacheService],
  exports: [PermissionService, SystemLogService, CacheService]
})
export class CommonModule {}