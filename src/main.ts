import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { TransformRequestInterceptor } from './common/interceptors/transform-request.interceptor';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { CaseTransformPipe } from './common/pipes/case-transform.pipe';
import { LoggerUtil } from './common/utils/logger.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',') : [],
    credentials: true,
  });
  
  app.useGlobalPipes(
    // new CaseTransformPipe(), // 주석 처리: DTO에서 직접 처리
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // 요청/응답 데이터 케이스 변환
  app.useGlobalInterceptors(
    // new TransformRequestInterceptor(), // camelCase → snake_case (임시 주석처리)
    new TransformResponseInterceptor(), // snake_case → camelCase
  );

  // 정적 파일 서빙 설정 (프로필 이미지 등)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const port = configService.get<string>('PORT');
  const serverBaseUrl = configService.get<string>('SERVER_BASE_URL');

  // Swagger/OpenAPI 설정 (환경변수로 제어)
  if (configService.get<string>('ENABLE_SWAGGER') !== 'false') {
    const documentBuilder = new DocumentBuilder()
      .setTitle('🧠 ExpertLink API')
      .setDescription(`
## 심리 상담 플랫폼 ExpertLink REST API

### 📋 주요 기능
- 🔐 **인증/인가**: JWT 기반 사용자 인증 및 권한 관리
- 👥 **사용자 관리**: 일반 사용자 및 전문가 계정 관리
- 📅 **예약 시스템**: 상담 일정 예약 및 관리
- 💬 **실시간 채팅**: WebSocket 기반 상담 채팅
- 📊 **심리 검사**: 다양한 심리 검사 도구 제공
- 📱 **알림**: 실시간 알림 및 푸시 서비스

### 🔑 인증 방법
Bearer Token을 사용합니다. 로그인 후 받은 access_token을 Authorization 헤더에 포함하세요.
"Authorization: Bearer <access_token>"

### 🌐 서버 정보
- **포트**: ${port}
- **환경**: ${process.env.NODE_ENV}
- **데이터베이스**: PostgreSQL
- **캐시**: Redis
- **메시지 큐**: RabbitMQ
      `)
      .setVersion('2.0.0')
      .setContact('ExpertLink Team', 'https://expertlink.com', 'contact@expertlink.com')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: '🔑 JWT 토큰을 입력하세요 (Bearer 접두사 없이)',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('🔐 auth', '인증 관련 API - 회원가입, 로그인, 토큰 관리')
      .addTag('👤 users', '사용자 관리 API - 프로필, 개인정보 관리')
      .addTag('👨‍⚕️ experts', '전문가 관련 API - 전문가 프로필, 자격증, 경력 관리')
      .addTag('📅 schedules', '일정 관리 API - 상담 가능 시간 설정 및 조회')
      .addTag('🗣️ counselings', '상담 관리 API - 상담 예약, 진행, 완료 처리')
      .addTag('💬 chat', '채팅 관련 API - 실시간 채팅, 메시지 기록')
      .addTag('📚 contents', '심리 콘텐츠 API - 교육자료, 아티클, 동영상')
      .addTag('🧠 psych-tests', '심리 검사 API - 다양한 심리 테스트 도구')
      .addTag('🔔 notifications', '알림 관리 API - 푸시 알림, 이메일 알림')
      .addTag('⚙️ admin', '관리자 API - 시스템 관리, 사용자 관리, 통계');

    // 환경변수에 서버 URL이 있으면 추가
    if (serverBaseUrl) {
      documentBuilder.addServer(serverBaseUrl, 'Production Server');
    }
    documentBuilder.addServer(`http://localhost:${port}`, 'Development Server');

    const config = documentBuilder.build();

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
  }
  
  await app.listen(port);

  LoggerUtil.info(`ExpertLink Server running on http://localhost:${port}`);
  
  if (configService.get<string>('ENABLE_SWAGGER') !== 'false') {
    LoggerUtil.info(`Swagger UI available at http://localhost:${port}/api-docs`);
    LoggerUtil.info(`ReDoc available at http://localhost:${port}/redoc`);
  }
  
  LoggerUtil.info('RabbitMQ STOMP WebSocket ready on ws://localhost:15674/ws');
}
bootstrap();