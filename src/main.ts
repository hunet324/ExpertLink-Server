import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  
  await app.listen(13000);
  console.log('ExpertLink Server running on http://localhost:3000');
}
bootstrap();