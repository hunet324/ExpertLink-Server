#!/bin/bash

# ExpertLink 개발 환경 시작 스크립트
# 실행 방법: ./start-dev.sh

echo "========================================"
echo "    ExpertLink 개발 환경 시작"
echo "========================================"

# 환경 변수 확인
if [ ! -f ".env" ]; then
    echo "⚠️  .env 파일이 없습니다. .env.example을 참고하여 생성하세요."
    exit 1
fi

echo "📋 환경 변수 로드 완료"

# Docker 서비스 시작 (PostgreSQL, Redis, RabbitMQ)
echo "🐳 Docker 서비스 시작 중..."
if [ -f "docker-compose.yml" ]; then
    docker-compose up -d
    
    # 서비스가 완전히 시작될 때까지 대기
    echo "⏳ 데이터베이스 서비스 시작 대기 중..."
    sleep 10
    
    # 서비스 상태 확인
    docker-compose ps
else
    echo "⚠️  docker-compose.yml 파일이 없습니다."
fi

echo ""
echo "📦 의존성 설치 확인 중..."
if [ ! -d "node_modules" ]; then
    echo "📥 npm 패키지 설치 중..."
    npm install
else
    echo "✅ node_modules가 이미 존재합니다."
fi

echo ""
echo "🏗️  TypeScript 컴파일 확인 중..."
npm run build

echo ""
echo "🚀 개발 서버 시작 중..."
echo "========================================"

# 개발 모드로 서버 시작 (watch 모드)
npm run start:dev