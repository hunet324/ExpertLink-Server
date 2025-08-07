# ExpertLink Database Design

## 📋 개요
ExpertLink는 심리 상담 및 전문가 매칭 플랫폼으로, PostgreSQL + Redis 하이브리드 구조를 사용합니다.

## 🏗️ 아키텍처

### Primary Database: PostgreSQL
- 핵심 비즈니스 데이터
- 사용자, 전문가, 상담, 예약 관리
- 트랜잭션 보장 및 복잡한 관계형 데이터 처리

### Cache & Session: Redis
- 세션 관리
- 실시간 알림 캐싱
- 검색 결과 캐싱
- 온라인 사용자 상태

## 📊 테이블 구조

### 사용자 관리
- **Users**: 기본 사용자 정보
- **LoginHistory**: 로그인 이력 추적

### 심리 테스트
- **PsychTest**: 설문 메타데이터
- **PsychQuestion**: 설문 문항
- **PsychAnswer**: 사용자 응답

### 상담 시스템
- **Schedule**: 전문가 일정
- **Counseling**: 상담 요청/관리

### 콘텐츠
- **Content**: 심리 콘텐츠, 저널, 활동

### 커뮤니케이션
- **Notification**: 알림 시스템

## 🔗 주요 관계
- User ↔ PsychAnswer (1:N)
- User ↔ Counseling (1:N) 
- Expert ↔ Schedule (1:N)
- Schedule ↔ Counseling (1:1)

## 🚀 확장 계획
1. **채팅 기능**: PostgreSQL JSONB로 구현 시작
2. **성능 최적화**: Redis 캐싱 레이어 추가
3. **대용량 처리**: 필요시 MongoDB 추가 고려

## 🔧 설치 & 설정

### PostgreSQL 설정
```bash
# Docker 실행 (예시)
docker run -d \
  --name expertlink-postgres \
  -e POSTGRES_DB=expertlink \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15
```

### Redis 설정
```bash
# Docker 실행
docker run -d \
  --name expertlink-redis \
  -p 6379:6379 \
  redis:7
```

### 환경변수 설정
```env
# .env 파일
DATABASE_URL=postgresql://admin:password@localhost:5432/expertlink
REDIS_URL=redis://localhost:6379
```

## 📝 마이그레이션
```bash
# TypeORM/Prisma 등을 사용한 마이그레이션 실행
npm run migration:run
```

## 🔍 인덱스 전략
- 사용자 검색: `email`, `user_type`
- 일정 조회: `expert_id`, `date`
- 상담 관리: `user_id`, `status`
- 알림 조회: `user_id`, `read`, `created_at`