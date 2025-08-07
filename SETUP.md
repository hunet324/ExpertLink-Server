# ExpertLink Server 설치 가이드

## 📋 사전 요구사항
- Node.js 18+ 
- PostgreSQL 15+ (또는 Docker)
- Redis 7+ (또는 Docker)
- Docker & Docker Compose (권장)

## 🚀 설치 단계

### 1. Docker로 데이터베이스 실행 (권장)
```bash
# Docker Compose로 PostgreSQL + Redis 실행
docker compose up -d

# 컨테이너 상태 확인
docker ps
```

### 2. 수동 데이터베이스 설치 (Docker 없이)

#### PostgreSQL 설치
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15

# macOS
brew install postgresql@15

# 데이터베이스 생성
createdb expertlink
```

#### Redis 설치
```bash
# Ubuntu/Debian  
sudo apt install redis-server

# macOS
brew install redis

# Redis 실행
redis-server
```

### 3. 데이터베이스 스키마 적용
```bash
# PostgreSQL에 스키마 적용
psql -d expertlink -f schema.sql

# 또는 관리자 계정으로
psql -U admin -d expertlink -h localhost -f schema.sql
```

### 4. 환경변수 확인
`.env` 파일이 올바르게 설정되어 있는지 확인:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=admin
DATABASE_PASSWORD=password123
DATABASE_NAME=expertlink

REDIS_HOST=localhost
REDIS_PORT=6379
```

### 5. 애플리케이션 실행
```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run start:dev

# 빌드 후 실행
npm run build
npm run start:prod
```

## 🔧 연결 테스트

### PostgreSQL 연결 확인
```bash
psql -U admin -d expertlink -h localhost
# 성공시 SQL 프롬프트 표시
```

### Redis 연결 확인  
```bash
redis-cli ping
# 응답: PONG
```

### API 테스트
```bash
curl http://localhost:5700/health
# 응답: {"status":"OK","timestamp":"..."}
```

## 🐛 문제 해결

### PostgreSQL 연결 오류
- 포트 5432가 사용 중인지 확인: `lsof -i :5432`
- PostgreSQL 서비스 상태 확인: `systemctl status postgresql`

### Redis 연결 오류  
- Redis 서비스 상태 확인: `systemctl status redis`
- 포트 6379 확인: `lsof -i :6379`

### Docker 관련 오류
```bash
# 컨테이너 로그 확인
docker logs expertlink-postgres
docker logs expertlink-redis

# 컨테이너 재시작
docker compose restart
```

## 📊 데이터베이스 관리

### 백업
```bash
pg_dump -U admin -h localhost expertlink > backup.sql
```

### 복원
```bash
psql -U admin -h localhost expertlink < backup.sql
```

### Redis 데이터 확인
```bash
redis-cli
> keys *
> get session:user123
```