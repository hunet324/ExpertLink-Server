import { IsString, IsNumber, IsNotEmpty, MaxLength, Min } from 'class-validator';

export class CreateCounselingDto {
  @IsNumber()
  @Min(1)
  expert_id: number;

  @IsNumber()
  @Min(1)
  schedule_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}