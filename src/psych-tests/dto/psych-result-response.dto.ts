import { Expose, Type } from 'class-transformer';

export class PsychResultDto {
  @Expose()
  id: number;

  @Expose()
  test_id: number;

  @Expose()
  test_title: string;

  @Expose()
  total_score?: number;

  @Expose()
  result_type?: string;

  @Expose()
  result_description?: string;

  @Expose()
  result_details: Record<string, any>;

  @Expose()
  @Type(() => Date)
  completed_at: Date;
}

export class PsychResultsListDto {
  @Expose()
  @Type(() => PsychResultDto)
  results: PsychResultDto[];

  @Expose()
  total: number;
}