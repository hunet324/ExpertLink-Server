import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Param, 
  Body, 
  UseGuards, 
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CounselingsService } from './counselings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { CreateCounselingDto } from './dto/create-counseling.dto';
import { UpdateCounselingStatusDto } from './dto/update-counseling-status.dto';
import { CounselingResponseDto } from './dto/counseling-response.dto';

@ApiTags('🗣️ counselings')
@Controller('counselings')
@UseGuards(JwtAuthGuard)
export class CounselingsController {
  constructor(private readonly counselingsService: CounselingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCounselingRequest(
    @Req() req: AuthenticatedRequest,
    @Body() createDto: CreateCounselingDto,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.createCounselingRequest(req.user.userId, createDto);
  }

  @Get()
  async getMyCounselings(@Req() req: AuthenticatedRequest): Promise<CounselingResponseDto[]> {
    return await this.counselingsService.getMyCounselings(req.user.userId);
  }

  @Get(':id')
  async getCounselingDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.getCounselingDetail(id, req.user.userId);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateCounselingStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateCounselingStatusDto,
  ): Promise<CounselingResponseDto> {
    return await this.counselingsService.updateCounselingStatus(id, req.user.userId, updateDto);
  }
}