import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, IsNumber, Min } from 'class-validator';
import { MessageType } from '../../entities/chat-message.entity';

export class CreateMessageDto {
  @IsEnum(MessageType)
  message_type: MessageType = MessageType.TEXT;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  file_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  file_name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  file_size?: number;
}