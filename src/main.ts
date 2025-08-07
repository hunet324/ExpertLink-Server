import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.enableCors({
    origin: ['http://localhost:5700'],
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 정적 파일 서빙 설정 (프로필 이미지 등)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger/OpenAPI 설정
  const config = new DocumentBuilder()
    .setTitle('ExpertLink API')
    .setDescription('심리 상담 플랫폼 ExpertLink의 REST API 문서')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', '인증 관련 API')
    .addTag('users', '사용자 관리 API')
    .addTag('experts', '전문가 관련 API')
    .addTag('schedules', '일정 관리 API')
    .addTag('counselings', '상담 관리 API')
    .addTag('chat', '채팅 관련 API')
    .addTag('contents', '심리 콘텐츠 API')
    .addTag('psych-tests', '심리 검사 API')
    .addTag('notifications', '알림 관리 API')
    .addTag('admin', '관리자 API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Swagger UI 설정 (기본 경로: /api-docs)
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // ReDoc 설정 (경로: /redoc)
  SwaggerModule.setup('redoc', app, document, {
    useGlobalPrefix: false,
    swaggerOptions: {
      spec: document,
      theme: 'redoc',
    },
  });
  
  const port = process.env.PORT || 5700;
  await app.listen(port);

  console.log(`ExpertLink Server running on http://localhost:${port}`);
  console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
  console.log(`ReDoc available at http://localhost:${port}/redoc`);
  console.log('RabbitMQ STOMP WebSocket ready on ws://localhost:15674/ws');
}
bootstrap();