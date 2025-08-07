import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PsychTestsService } from './psych-tests.service';
import { PsychTestListDto, PsychTestDetailDto } from './dto/psych-test-response.dto';
import { SubmitAnswersDto, SubmitAnswersResponseDto } from './dto/submit-answers.dto';
import { PsychResultDto } from './dto/psych-result-response.dto';

interface RequestWithUser {
  user?: {
    userId: number;
    email: string;
    userType: string;
  };
}

@Controller('psych-tests')
export class PsychTestsController {
  constructor(private readonly psychTestsService: PsychTestsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard) // 비로그인도 접근 가능하지만 로그인 시 완료 정보 제공
  async getPsychTests(@Req() req: RequestWithUser): Promise<PsychTestListDto[]> {
    const userId = req.user?.userId;
    return await this.psychTestsService.getPsychTests(userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard) // 비로그인도 접근 가능
  async getPsychTestById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<PsychTestDetailDto> {
    const userId = req.user?.userId;
    return await this.psychTestsService.getPsychTestById(id, userId);
  }

  @Post(':id/answers')
  @UseGuards(JwtAuthGuard) // 로그인 필수
  @HttpCode(HttpStatus.OK)
  async submitAnswers(
    @Param('id', ParseIntPipe) id: number,
    @Body() submitAnswersDto: SubmitAnswersDto,
    @Req() req: RequestWithUser,
  ): Promise<SubmitAnswersResponseDto> {
    const userId = req.user.userId;
    return await this.psychTestsService.submitAnswers(id, userId, submitAnswersDto);
  }
}

@Controller('users')
export class UsersPsychResultsController {
  constructor(private readonly psychTestsService: PsychTestsService) {}

  @Get('psych-results')
  @UseGuards(JwtAuthGuard) // 로그인 필수
  async getUserPsychResults(@Req() req: RequestWithUser): Promise<PsychResultDto[]> {
    const userId = req.user.userId;
    return await this.psychTestsService.getUserPsychResults(userId);
  }
}