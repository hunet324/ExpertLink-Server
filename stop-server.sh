#!/bin/bash

# ExpertLink 서버 종료 스크립트
# 실행 방법: ./stop-server.sh

echo "========================================"
echo "      ExpertLink 서버 종료"
echo "========================================"

# PM2 프로세스 확인 및 종료
if command -v pm2 &> /dev/null; then
    echo "🔍 PM2 프로세스 확인 중..."
    PM2_PROCESSES=$(pm2 list | grep "expertlink-server" | wc -l)
    
    if [ $PM2_PROCESSES -gt 0 ]; then
        echo "🛑 PM2 프로세스 종료 중..."
        pm2 stop expertlink-server 2>/dev/null
        pm2 delete expertlink-server 2>/dev/null
        echo "✅ PM2 프로세스 종료 완료"
    else
        echo "ℹ️  실행 중인 PM2 프로세스가 없습니다."
    fi
fi

# 개발 서버 프로세스 종료
echo "🔍 개발 서버 프로세스 확인 중..."
NEST_PIDS=$(pgrep -f "nest start")
if [ -n "$NEST_PIDS" ]; then
    echo "🛑 개발 서버 프로세스 종료 중... (PID: $NEST_PIDS)"
    kill -TERM $NEST_PIDS 2>/dev/null
    sleep 3
    
    # 여전히 실행 중이면 강제 종료
    if pgrep -f "nest start" > /dev/null; then
        echo "⚠️  강제 종료 중..."
        pkill -9 -f "nest start"
    fi
    echo "✅ 개발 서버 종료 완료"
else
    echo "ℹ️  실행 중인 개발 서버가 없습니다."
fi

# Node.js 프로세스 종료
echo "🔍 Node.js 프로세스 확인 중..."
NODE_PIDS=$(pgrep -f "node.*dist/main")
if [ -n "$NODE_PIDS" ]; then
    echo "🛑 Node.js 프로세스 종료 중... (PID: $NODE_PIDS)"
    kill -TERM $NODE_PIDS 2>/dev/null
    sleep 3
    
    if pgrep -f "node.*dist/main" > /dev/null; then
        echo "⚠️  강제 종료 중..."
        pkill -9 -f "node.*dist/main"
    fi
    echo "✅ Node.js 프로세스 종료 완료"
else
    echo "ℹ️  실행 중인 Node.js 프로세스가 없습니다."
fi

# .env 파일에서 PORT 변수 읽기
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 포트 확인 및 정리
echo "🔍 포트 ${PORT} 상태 확인 중..."
PORT_PID=$(lsof -ti:${PORT} 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "🛑 포트 ${PORT} 사용 프로세스 종료 중... (PID: $PORT_PID)"
    kill -9 $PORT_PID 2>/dev/null
    echo "✅ 포트 정리 완료"
else
    echo "ℹ️  포트 ${PORT}이 비어있습니다."
fi

# Docker 서비스 종료 옵션
echo ""
echo "🐳 Docker 서비스 종료 옵션:"
echo "  전체 종료: docker-compose down"
echo "  데이터 유지 종료: docker-compose stop"
echo ""
read -p "Docker 서비스도 종료하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "docker-compose.yml" ]; then
        echo "🛑 Docker 서비스 종료 중..."
        docker-compose stop
        echo "✅ Docker 서비스 종료 완료"
    fi
fi

echo ""
echo "========================================"
echo "✅ 서버 종료가 완료되었습니다!"
echo "========================================"