# ExpertLink 서버 관리 스크립트

서버 실행, 종료, 재시작을 위한 편리한 쉘 스크립트 모음입니다.

## 📋 스크립트 목록

### 1. 🔄 `restart-server.sh` - 서버 재시작 (권장)
```bash
./restart-server.sh
```
- 실행 중인 서버 프로세스를 안전하게 종료
- 포트 ${PORT} 정리
- 개발 모드로 서버 재시작
- **가장 자주 사용하는 스크립트**

### 2. 🚀 `start-dev.sh` - 개발 환경 시작
```bash
./start-dev.sh
```
- .env 파일 확인
- Docker 서비스 시작 (PostgreSQL, Redis, RabbitMQ)
- 의존성 설치 확인
- 개발 모드로 서버 시작

### 3. 🏭 `start-prod.sh` - 프로덕션 환경 시작
```bash
./start-prod.sh
```
- 프로덕션 환경 설정 확인
- Docker 서비스 시작 및 헬스체크
- 프로덕션 빌드
- PM2로 클러스터 모드 실행

### 4. 🛑 `stop-server.sh` - 서버 종료
```bash
./stop-server.sh
```
- PM2 프로세스 종료
- 개발/프로덕션 서버 프로세스 종료
- 포트 정리
- Docker 서비스 종료 옵션

## 🎯 사용 시나리오

### 개발 중 코드 변경 후 빠른 재시작
```bash
./restart-server.sh
```

### 처음 개발 환경 구축
```bash
./start-dev.sh
```

### 프로덕션 배포
```bash
./start-prod.sh
```

### 모든 서비스 완전 종료
```bash
./stop-server.sh
```

## 📊 서버 상태 확인

### 개발 환경
- 서버 주소: http://localhost:${PORT}
- Swagger UI: http://localhost:${PORT}/api-docs
- ReDoc: http://localhost:${PORT}/redoc

### 프로덕션 환경 (PM2 사용시)
```bash
pm2 list          # 프로세스 목록
pm2 logs          # 로그 확인
pm2 monit         # 모니터링
pm2 restart all   # 전체 재시작
```

### Docker 서비스 확인
```bash
docker-compose ps     # 서비스 상태
docker-compose logs   # 로그 확인
```

## ⚠️ 주의사항

1. **권한 설정**: 스크립트 실행 권한이 자동으로 설정되었습니다.
2. **환경 변수**: `.env` 파일이 필요합니다.
3. **Docker**: PostgreSQL, Redis, RabbitMQ가 Docker로 실행됩니다.
4. **포트**: 기본 포트 ${PORT}을 사용합니다.

## 🔧 문제 해결

### 포트가 이미 사용 중인 경우
```bash
./stop-server.sh  # 먼저 완전 종료
./restart-server.sh  # 재시작
```

### Docker 서비스 문제
```bash
docker-compose down
docker-compose up -d
```

### PM2 문제 (프로덕션)
```bash
pm2 kill  # 모든 PM2 프로세스 종료
./start-prod.sh  # 다시 시작
```