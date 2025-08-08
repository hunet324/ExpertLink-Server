#!/bin/bash

# ExpertLink 프로덕션 환경 시작 스크립트
# 실행 방법: ./start-prod.sh

echo "========================================"
echo "    ExpertLink 프로덕션 환경 시작"
echo "========================================"

# 환경 변수 확인
if [ ! -f ".env" ]; then
    echo "❌ .env 파일이 없습니다. 프로덕션 환경 설정이 필요합니다."
    exit 1
fi

# NODE_ENV 확인
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  NODE_ENV가 production으로 설정되어 있지 않습니다."
    echo "export NODE_ENV=production을 실행하거나 .env 파일을 확인하세요."
fi

echo "📋 환경 변수 로드 완료"

# 기존 프로세스 종료
echo "🔍 기존 서버 프로세스 확인 중..."
PIDS=$(pgrep -f "node dist/main")
if [ -n "$PIDS" ]; then
    echo "🛑 기존 서버 프로세스 종료 중..."
    kill -TERM $PIDS 2>/dev/null
    sleep 5
    
    # 강제 종료가 필요한 경우
    if pgrep -f "node dist/main" > /dev/null; then
        echo "⚠️  강제 종료 중..."
        pkill -9 -f "node dist/main"
        sleep 2
    fi
fi

# Docker 서비스 시작
echo "🐳 Docker 서비스 시작 중..."
if [ -f "docker-compose.yml" ]; then
    docker-compose up -d
    
    echo "⏳ 서비스 시작 대기 중..."
    sleep 15
    
    # 서비스 상태 확인
    docker-compose ps
    
    # 헬스체크
    echo "🔍 서비스 헬스체크 중..."
    docker-compose exec postgres pg_isready -U admin -d expertlink || echo "⚠️ PostgreSQL 연결 실패"
    docker-compose exec redis redis-cli ping || echo "⚠️ Redis 연결 실패"
fi

# 의존성 설치 (프로덕션용)
echo "📦 프로덕션 의존성 설치 중..."
npm ci --only=production

# 빌드
echo "🏗️  애플리케이션 빌드 중..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ 빌드 실패: dist 폴더가 없습니다."
    exit 1
fi

echo "✅ 빌드 완료"

# PM2가 설치되어 있는지 확인
if ! command -v pm2 &> /dev/null; then
    echo "📥 PM2 설치 중..."
    npm install -g pm2
fi

# PM2로 서버 시작
echo "🚀 PM2로 프로덕션 서버 시작 중..."

# PM2 ecosystem 설정 파일이 있는지 확인
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js --env production
else
    pm2 start dist/main.js --name "expertlink-server" --instances max --exec-mode cluster
fi

echo ""
echo "📊 PM2 프로세스 상태:"
pm2 list

echo ""
echo "📋 PM2 로그 확인:"
echo "  pm2 logs expertlink-server"
echo "  pm2 monit"

echo ""
echo "🔄 PM2 관리 명령어:"
echo "  pm2 restart expertlink-server"
echo "  pm2 stop expertlink-server"
echo "  pm2 delete expertlink-server"

echo ""
echo "========================================"
echo "✨ 프로덕션 서버가 시작되었습니다!"

# .env 파일에서 PORT 변수 읽기
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "🌐 서버 URL: http://localhost:${PORT}"
echo "📄 API 문서: http://localhost:${PORT}/api-docs"
echo "========================================"