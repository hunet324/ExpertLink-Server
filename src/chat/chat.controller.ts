import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Body, 
  Query,
  UseGuards, 
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatRoomResponseDto } from './dto/chat-room-response.dto';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';

@ApiTags('💬 chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  async getUserChatRooms(@Req() req: AuthenticatedRequest): Promise<ChatRoomResponseDto[]> {
    return await this.chatService.getUserChatRooms(req.user.userId);
  }

  @Get('rooms/:id/messages')
  async getChatRoomMessages(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 50,
  ): Promise<{ messages: ChatMessageResponseDto[]; total: number; hasMore: boolean }> {
    return await this.chatService.getChatRoomMessages(roomId, req.user.userId, page, limit);
  }

  @Post('rooms/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<ChatMessageResponseDto> {
    return await this.chatService.createMessage(roomId, req.user.userId, createMessageDto);
  }

  @Post('rooms/:id/messages/:messageId/read')
  @HttpCode(HttpStatus.OK)
  async markMessageAsRead(
    @Param('id', ParseIntPipe) roomId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.chatService.markMessageAsRead(messageId, req.user.userId);
    return { success: true };
  }

  @Post('rooms/counseling/:counselingId')
  @HttpCode(HttpStatus.CREATED)
  async createChatRoomFromCounseling(
    @Param('counselingId', ParseIntPipe) counselingId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChatRoomResponseDto> {
    return await this.chatService.createChatRoomFromCounseling(counselingId);
  }
}