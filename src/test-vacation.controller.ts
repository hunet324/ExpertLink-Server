import { Controller, Get } from '@nestjs/common';

@Controller('test-vacation')
export class TestVacationController {
  @Get()
  async getTest(): Promise<any> {
    return { message: 'Test vacation controller working!' };
  }
}