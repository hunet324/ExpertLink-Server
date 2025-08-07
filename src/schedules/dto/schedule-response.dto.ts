import { Expose, Transform } from 'class-transformer';
import { ScheduleStatus } from '../../entities/schedule.entity';

export class ScheduleResponseDto {
  @Expose()
  id: number;

  @Expose()
  expert_id: number;

  @Expose()
  title: string;

  @Expose()
  schedule_date: Date;

  @Expose()
  start_time: string;

  @Expose()
  end_time: string;

  @Expose()
  status: ScheduleStatus;

  @Expose()
  notes: string;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;
}