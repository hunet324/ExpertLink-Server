# PostgreSQL 데이터베이스 설정 가이드

## 🔧 현재 발생한 문제

서버 실행 시 다음 오류가 발생하고 있습니다:
```
password authentication failed for user "admin"
role "kwonsy" does not exist
```

## ✅ 해결 방법

### 방법 1: PostgreSQL 사용자 생성 (권장)

```bash
# 1. PostgreSQL 슈퍼유저로 접속
sudo -u postgres psql

# 2. 데이터베이스와 사용자 생성
CREATE USER admin WITH ENCRYPTED PASSWORD 'password123';
CREATE DATABASE expertlink OWNER admin;
GRANT ALL PRIVILEGES ON DATABASE expertlink TO admin;

# 3. 권한 설정 확인
\du
\l

# 4. 종료
\q
```

### 방법 2: 현재 시스템 사용자 활용

```bash
# 1. PostgreSQL 슈퍼유저로 접속
sudo -u postgres psql

# 2. 현재 사용자 생성
CREATE USER kwonsy WITH CREATEDB;
ALTER USER kwonsy WITH SUPERUSER;

# 3. 데이터베이스 생성
CREATE DATABASE expertlink OWNER kwonsy;

# 4. 종료
\q
```

### 방법 3: Docker 사용 (가장 간단)

```bash
# Docker 권한 설정 (한 번만)
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose로 서비스 시작
docker-compose up -d

# 컨테이너 상태 확인
docker-compose ps
```

## 🔄 설정 완료 후

위 방법 중 하나를 선택한 후 `.env` 파일을 적절히 수정하세요:

### 방법 1을 선택한 경우:
```env
DATABASE_USERNAME=admin
DATABASE_PASSWORD=password123
DATABASE_NAME=expertlink
```

### 방법 2를 선택한 경우:
```env
DATABASE_USERNAME=kwonsy
DATABASE_PASSWORD=
DATABASE_NAME=expertlink
```

### 방법 3을 선택한 경우:
```env
DATABASE_USERNAME=admin
DATABASE_PASSWORD=password123
DATABASE_NAME=expertlink
```

## 🚀 서버 실행

데이터베이스 설정 완료 후:
```bash
./restart-server.sh
```

## 🔍 연결 테스트

```bash
# PostgreSQL 연결 테스트
psql -h localhost -p 5432 -U admin -d expertlink -c "SELECT version();"

# 서버 로그 확인
# 정상 연결시: "Database connected successfully" 메시지 확인
```