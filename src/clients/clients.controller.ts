import { Controller, Get, Put, Query, Param, Body, ParseIntPipe, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { ClientSearchDto } from './dto/client-search.dto';
import { ClientListResponseDto, ClientDetailResponseDto } from './dto/client-response.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../common/guards/expert.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';

@ApiTags('👥 내담자 관리')
@Controller('clients')
@UseGuards(JwtAuthGuard, ExpertGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('my')
  @ApiOperation({ 
    summary: '👥 내 내담자 목록 조회', 
    description: '로그인한 전문가와 상담한 적이 있는 내담자들의 목록을 조회합니다.' 
  })
  @ApiResponse({ type: [ClientListResponseDto] })
  async getMyClients(
    @Req() req: AuthenticatedRequest,
    @Query() searchDto: ClientSearchDto
  ): Promise<{
    clients: ClientListResponseDto[];
    total: number;
    page: number;
    total_pages: number;
  }> {
    return await this.clientsService.getMyClients(req.user.userId, searchDto);
  }

  @Get('search')
  @ApiOperation({ 
    summary: '🔍 내담자 검색', 
    description: '모든 내담자를 검색합니다. (일정 등록용)' 
  })
  @ApiResponse({ type: [ClientListResponseDto] })
  async searchAllClients(
    @Req() req: AuthenticatedRequest,
    @Query('search') searchTerm?: string
  ): Promise<ClientListResponseDto[]> {
    return await this.clientsService.searchAllClients(req.user.userId, searchTerm);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: '👤 내담자 상세 정보 조회', 
    description: '특정 내담자의 상세 정보와 상담 이력을 조회합니다.' 
  })
  @ApiResponse({ type: ClientDetailResponseDto })
  async getClientDetail(
    @Param('id', ParseIntPipe) clientId: number,
    @Req() req: AuthenticatedRequest
  ): Promise<ClientDetailResponseDto> {
    return await this.clientsService.getClientDetail(clientId, req.user.userId);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '✏️ 내담자 정보 수정', 
    description: '내담자의 기본 정보, 관심사, 위험도 평가, 메모 등을 수정합니다.' 
  })
  @ApiResponse({ type: ClientDetailResponseDto })
  async updateClient(
    @Param('id', ParseIntPipe) clientId: number,
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateClientDto
  ): Promise<ClientDetailResponseDto> {
    return await this.clientsService.updateClient(clientId, req.user.userId, updateDto);
  }
}