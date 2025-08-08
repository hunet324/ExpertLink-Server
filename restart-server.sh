#!/bin/bash

# ExpertLink 서버 재시작 스크립트
# 실행 방법: ./restart-server.sh

echo "========================================"
echo "    ExpertLink 서버 재시작 스크립트"
echo "========================================"

# 현재 실행 중인 Node.js 프로세스 종료
echo "🔍 실행 중인 서버 프로세스 확인 중..."
PIDS=$(pgrep -f "nest start")

if [ -n "$PIDS" ]; then
    echo "📋 발견된 프로세스: $PIDS"
    echo "🛑 서버 프로세스 종료 중..."
    kill -TERM $PIDS 2>/dev/null
    
    # 프로세스가 종료될 때까지 대기 (최대 10초)
    for i in {1..10}; do
        if ! pgrep -f "nest start" > /dev/null; then
            echo "✅ 서버가 정상적으로 종료되었습니다."
            break
        fi
        echo "⏳ 종료 대기 중... ($i/10)"
        sleep 1
    done
    
    # 여전히 실행 중이면 강제 종료
    if pgrep -f "nest start" > /dev/null; then
        echo "⚠️  정상 종료 실패. 강제 종료 중..."
        pkill -9 -f "nest start"
        sleep 2
    fi
else
    echo "ℹ️  실행 중인 서버가 없습니다."
fi

# 포트 5700이 사용 중인지 확인 및 해제
echo "🔍 포트 5700 상태 확인 중..."
PORT_PID=$(lsof -ti:5700 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "⚠️  포트 5700이 사용 중입니다. 프로세스 ID: $PORT_PID"
    echo "🛑 포트 5700 사용 프로세스 종료 중..."
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
fi

# Docker 컨테이너 상태 확인 (선택적)
echo "🐳 Docker 서비스 확인 중..."
if command -v docker-compose &> /dev/null; then
    if [ -f "docker-compose.yml" ]; then
        echo "📦 Docker Compose 파일 존재. 필요시 수동 실행: docker-compose up -d"
        echo "ℹ️  현재는 로컬 PostgreSQL, Redis, RabbitMQ 사용"
    fi
else
    echo "ℹ️  Docker Compose 미설치 - 로컬 서비스 사용"
fi

echo ""
echo "🚀 서버 재시작 중..."
echo "========================================"

# 개발 모드로 서버 시작
npm run start:dev

echo ""
echo "========================================"
echo "✨ 서버가 시작되었습니다!"
echo "📄 Swagger UI: http://localhost:5700/api-docs"
echo "📚 ReDoc: http://localhost:5700/redoc"
echo "========================================"