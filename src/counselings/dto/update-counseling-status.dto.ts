import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CounselingStatus } from '../../entities/counseling.entity';

export class UpdateCounselingStatusDto {
  @IsEnum(CounselingStatus)
  status: CounselingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejection_reason?: string;
}