import { Request } from 'express';
import { UserType } from '../../entities/user.entity';

export interface AuthenticatedUser {
  userId: number;
  id: number; // userId의 별칭
  email: string;
  name?: string;
  userType: string;
  user_type: UserType; // enum 타입
  centerId?: number;
  center_id?: number; // centerId의 별칭
  supervisorId?: number;
  supervisor_id?: number; // supervisorId의 별칭
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}