import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsNumber()
  @IsNotEmpty()
  question_id: number;

  @IsString()
  @IsNotEmpty()
  answer_value: string;
}

export class SubmitAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

export class SubmitAnswersResponseDto {
  @IsString()
  message: string;

  @IsNumber()
  result_id: number;

  @IsString()
  result_type?: string;

  @IsString()
  result_description?: string;

  total_score?: number;

  result_details?: Record<string, any>;
}