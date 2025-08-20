import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule, ScheduleStatus } from '../entities/schedule.entity';
import { User, UserType } from '../entities/user.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private schedulesRepository: Repository<Schedule>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getExpertSchedules(expertId: number, userId: number): Promise<ScheduleResponseDto[]> {
    // 본인 일정 조회 또는 관리자
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (userId !== expertId && ![UserType.SUPER_ADMIN, UserType.REGIONAL_MANAGER, UserType.CENTER_MANAGER, UserType.STAFF].includes(user.user_type as UserType)) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    const schedules = await this.schedulesRepository
      .createQueryBuilder('schedule')
      .where('schedule.expert_id = :expertId', { expertId })
      .orderBy('schedule.schedule_date', 'ASC')
      .addOrderBy('schedule.start_time', 'ASC')
      .getMany();

    return schedules.map(schedule => 
      plainToClass(ScheduleResponseDto, schedule, {
        excludeExtraneousValues: true,
      })
    );
  }

  async getAvailableSchedules(expertId: number): Promise<ScheduleResponseDto[]> {
    const schedules = await this.schedulesRepository
      .createQueryBuilder('schedule')
      .where('schedule.expert_id = :expertId', { expertId })
      .andWhere('schedule.status = :status', { status: ScheduleStatus.AVAILABLE })
      .andWhere('schedule.schedule_date >= :today', { today: new Date() })
      .orderBy('schedule.schedule_date', 'ASC')
      .addOrderBy('schedule.start_time', 'ASC')
      .getMany();

    return schedules.map(schedule => 
      plainToClass(ScheduleResponseDto, schedule, {
        excludeExtraneousValues: true,
      })
    );
  }

  async createSchedule(userId: number, createDto: CreateScheduleDto): Promise<ScheduleResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user || user.user_type !== UserType.EXPERT) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    // 시간 검증
    if (createDto.start_time >= createDto.end_time) {
      throw new BadRequestException('종료 시간은 시작 시간보다 늦어야 합니다.');
    }

    // 날짜 검증 (과거 날짜 불가)
    const scheduleDate = new Date(createDto.schedule_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (scheduleDate < today) {
      throw new BadRequestException('과거 날짜에는 일정을 생성할 수 없습니다.');
    }

    // 중복 일정 확인
    const existingSchedule = await this.schedulesRepository
      .createQueryBuilder('schedule')
      .where('schedule.expert_id = :expertId', { expertId: userId })
      .andWhere('schedule.schedule_date = :date', { date: createDto.schedule_date })
      .andWhere('schedule.start_time = :startTime', { startTime: createDto.start_time })
      .getOne();

    if (existingSchedule) {
      throw new BadRequestException('해당 시간에 이미 일정이 존재합니다.');
    }

    const schedule = this.schedulesRepository.create({
      expert_id: userId,
      ...createDto,
      status: ScheduleStatus.AVAILABLE,
    });

    const savedSchedule = await this.schedulesRepository.save(schedule);

    return plainToClass(ScheduleResponseDto, savedSchedule, {
      excludeExtraneousValues: true,
    });
  }

  async updateSchedule(scheduleId: number, userId: number, updateDto: UpdateScheduleDto): Promise<ScheduleResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user || user.user_type !== UserType.EXPERT) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    const schedule = await this.schedulesRepository.findOne({
      where: { id: scheduleId }
    });

    if (!schedule) {
      throw new NotFoundException('일정을 찾을 수 없습니다.');
    }

    if (schedule.expert_id !== userId) {
      throw new ForbiddenException('본인의 일정만 수정할 수 있습니다.');
    }

    // 시간 검증
    if (updateDto.start_time && updateDto.end_time && updateDto.start_time >= updateDto.end_time) {
      throw new BadRequestException('종료 시간은 시작 시간보다 늦어야 합니다.');
    }

    // 예약된 일정의 경우 제한적 수정만 허용
    if (schedule.status === ScheduleStatus.BOOKED) {
      const allowedFields = ['notes', 'status'];
      const updateFields = Object.keys(updateDto);
      const invalidFields = updateFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        throw new BadRequestException('예약된 일정은 메모와 상태만 수정할 수 있습니다.');
      }
    }

    // 업데이트 적용
    Object.assign(schedule, updateDto);
    const updatedSchedule = await this.schedulesRepository.save(schedule);

    return plainToClass(ScheduleResponseDto, updatedSchedule, {
      excludeExtraneousValues: true,
    });
  }

  async deleteSchedule(scheduleId: number, userId: number): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user || user.user_type !== UserType.EXPERT) {
      throw new ForbiddenException('전문가 권한이 필요합니다.');
    }

    const schedule = await this.schedulesRepository.findOne({
      where: { id: scheduleId }
    });

    if (!schedule) {
      throw new NotFoundException('일정을 찾을 수 없습니다.');
    }

    if (schedule.expert_id !== userId) {
      throw new ForbiddenException('본인의 일정만 삭제할 수 있습니다.');
    }

    if (schedule.status === ScheduleStatus.BOOKED) {
      throw new BadRequestException('예약된 일정은 삭제할 수 없습니다.');
    }

    await this.schedulesRepository.remove(schedule);
  }
}