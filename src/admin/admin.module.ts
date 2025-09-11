import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { ExpertProfile } from '../entities/expert-profile.entity';
import { Counseling } from '../entities/counseling.entity';
import { Content } from '../entities/content.entity';
import { PsychTest } from '../entities/psych-test.entity';
import { PsychQuestion } from '../entities/psych-question.entity';
import { PsychResult } from '../entities/psych-result.entity';
import { LogicRule } from '../entities/logic-rule.entity';
import { SystemLog } from '../entities/system-log.entity';
import { SystemSetting } from '../entities/system-setting.entity';
import { Payment } from '../entities/payment.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { ChatMessage } from '../entities/chat-message.entity';
// 새로운 권한 시스템 엔티티들
import { AdminRole } from '../entities/admin-role.entity';
import { AdminPermission } from '../entities/admin-permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { NotificationTemplateAdminController } from './notification-template-admin.controller';
// 새로운 권한 시스템 컨트롤러와 서비스
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminPermissionsService } from './admin-permissions.service';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';
import { PermissionService } from '../common/services/permission.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ExpertProfile,
      Counseling,
      Content,
      PsychTest,
      PsychQuestion,
      PsychResult,
      LogicRule,
      SystemLog,
      SystemSetting,
      Payment,
      Notification,
      NotificationTemplate,
      ChatMessage,
      // 새로운 권한 시스템 엔티티들
      AdminRole,
      AdminPermission,
      RolePermission,
      UserRole,
      AdminAuditLog,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
    NotificationsModule, // 알림 서비스 사용을 위해 import
    UsersModule, // UsersService 사용을 위해 import
  ],
  providers: [AdminService, AdminPermissionsService, SystemSettingsService],
  controllers: [AdminController, NotificationTemplateAdminController, AdminPermissionsController, SystemSettingsController],
  exports: [AdminService],
})
export class AdminModule {}