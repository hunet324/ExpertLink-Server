import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Param, 
  Body, 
  Query,
  UseGuards, 
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get('rooms/:id')
  async getChatRoom(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChatRoomResponseDto> {
    return await this.chatService.getChatRoom(roomId, req.user.userId);
  }

  @Post('rooms/:id/join')
  @HttpCode(HttpStatus.OK)
  async joinChatRoom(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; sessionInfo: any }> {
    const sessionInfo = await this.chatService.joinChatRoom(roomId, req.user.userId);
    return { success: true, sessionInfo };
  }

  @Post('rooms/:id/leave')
  @HttpCode(HttpStatus.OK)
  async leaveChatRoom(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.chatService.leaveChatRoom(roomId, req.user.userId);
    return { success: true };
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessageToRoom(
    @Body() createMessageDto: CreateMessageDto & { roomId: number },
    @Req() req: AuthenticatedRequest,
  ): Promise<ChatMessageResponseDto> {
    return await this.chatService.createMessage(createMessageDto.roomId, req.user.userId, createMessageDto);
  }

  @Put('messages/:messageId/read')
  @HttpCode(HttpStatus.OK)
  async markSingleMessageAsRead(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.chatService.markMessageAsRead(messageId, req.user.userId);
    return { success: true };
  }

  @Put('rooms/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAllRoomMessagesAsRead(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; markedCount: number }> {
    const markedCount = await this.chatService.markAllRoomMessagesAsRead(roomId, req.user.userId);
    return { success: true, markedCount };
  }

  @Get('rooms/counseling/:counselingId')
  async getChatRoomByCounseling(
    @Param('counselingId', ParseIntPipe) counselingId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChatRoomResponseDto | null> {
    return await this.chatService.getChatRoomByCounseling(counselingId, req.user.userId);
  }

  @Get('rooms/:id/session')
  async getChatSession(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return await this.chatService.getChatSessionInfo(roomId, req.user.userId);
  }

  @Get('unread-count')
  async getUnreadMessageCount(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ count: number }> {
    const count = await this.chatService.getUserUnreadMessageCount(req.user.userId);
    return { count };
  }

  @Post('rooms/counseling/:counselingId')
  @HttpCode(HttpStatus.CREATED)
  async createChatRoomFromCounseling(
    @Param('counselingId', ParseIntPipe) counselingId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChatRoomResponseDto> {
    return await this.chatService.createChatRoomFromCounseling(counselingId);
  }

  @Post('rooms/:id/upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id', ParseIntPipe) roomId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ fileUrl: string; fileName: string; fileSize: number }> {
    return await this.chatService.uploadFile(roomId, file, req.user.userId);
  }
}