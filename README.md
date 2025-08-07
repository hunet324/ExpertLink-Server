# ExpertLink Server

## 1. 프로젝트 소개

**ExpertLink**는 심리 상담 전문가와 사용자를 연결하는 온라인 상담 플랫폼의 백엔드 서버입니다. NestJS 프레임워크를 기반으로 구축되었으며, 실시간 채팅, 상담 예약, 콘텐츠 제공 등 다양한 기능을 통해 사용자에게 종합적인 심리 케어 서비스를 제공하는 것을 목표로 합니다.

이 프로젝트는 확장성과 유지보수성을 고려한 모듈식 아키텍처와 RabbitMQ를 활용한 이벤트 기반 통신 구조를 채택하여 안정적이고 효율적인 서비스 운영을 지원합니다.

---

## 2. 주요 기능

- **사용자 및 인증**: JWT 기반의 안전한 회원가입 및 로그인/로그아웃 기능을 제공합니다.
- **전문가**: 전문가 목록을 검색하고 상세 프로필을 조회할 수 있으며, 전문가 자신은 프로필과 상담 가능 일정을 관리할 수 있습니다.
- **상담 예약**: 사용자는 전문가의 스케줄을 확인하고 상담을 신청할 수 있으며, 전문가는 이를 수락/거절할 수 있습니다.
- **실시간 채팅**: 상담이 성사되면 사용자와 전문가는 RabbitMQ STOMP를 통해 1:1 실시간 채팅을 진행할 수 있습니다. (타이핑 상태, 메시지 읽음 처리 포함)
- **심리 콘텐츠**: 전문가가 작성한 아티클, 영상 등의 콘텐츠를 열람하고 '좋아요'나 '북마크'를 통해 상호작용할 수 있습니다.
- **비동기 처리**: RabbitMQ를 사용하여 알림, 데이터 업데이트 등 시간이 소요되는 작업을 비동기적으로 처리하여 API 응답 속도를 최적화합니다.

---

## 3. 기술 스택 및 아키텍처

- **Backend**: `NestJS`, `TypeScript`
- **Database**: `PostgreSQL`
- **ORM**: `TypeORM`
- **Cache / In-memory Store**: `Redis`
- **Message Queue / Real-time**: `RabbitMQ` (with STOMP Plugin)
- **Authentication**: `Passport.js` (JWT Strategy)
- **Containerization**: `Docker`, `Docker Compose`

### 시스템 아키텍처 다이어그램

```
+-----------------+      +---------------------+      +-----------------+
|     Client      |----->|    NestJS Server    |<---->|   PostgreSQL    |
| (Web/App/etc.)  |      |  (API & Gateway)    |      |   (Main DB)     |
+-----------------+      +----------+----------+      +-----------------+
       ^                     |        |                      ^
       | STOMP/WebSocket     |        | REST API             |
       |                     |        |                      |
+------v----------+      +---v----+---+---+      +-----------v-----+
|  RabbitMQ       |<---->|  Consumers   |<---->|      Redis      |
| (Message Broker)|      | (Async Tasks)|      | (Cache, Lock)   |
+-----------------+      +--------------+      +-----------------+
```

---

## 4. 시작하기

### 사전 요구사항

- `Node.js` (v18 이상)
- `npm` or `yarn`
- `Docker`
- `Docker Compose`

### 설치 및 실행

1.  **프로젝트 클론**
    ```bash
    git clone <repository-url>
    cd ExpertLink-Server
    ```

2.  **환경변수 설정**
    프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 참고하여 작성합니다.
    ```env
    # Server
    PORT=5700

    # Database (PostgreSQL)
    DATABASE_HOST=localhost
    DATABASE_PORT=5432
    DATABASE_USERNAME=admin
    DATABASE_PASSWORD=password123
    DATABASE_NAME=expertlink

    # RabbitMQ
    RABBITMQ_URL=amqp://admin:password123@localhost:5672/expertlink

    # Redis
    REDIS_HOST=localhost
    REDIS_PORT=6379

    # JWT
    JWT_SECRET=your-very-secret-key
    JWT_EXPIRATION_TIME=1h
    REFRESH_TOKEN_SECRET=your-very-secret-refresh-key
    REFRESH_TOKEN_EXPIRATION_TIME=7d
    ```

3.  **인프라 실행 (Docker)**
    `docker-compose.yml` 파일이 있는 루트 디렉토리에서 아래 명령어를 실행하여 PostgreSQL, Redis, RabbitMQ 컨테이너를 실행합니다.
    ```bash
    docker-compose up -d
    ```
    - **PostgreSQL**: `localhost:5432`
    - **Redis**: `localhost:6379`
    - **RabbitMQ Management UI**: `http://localhost:15672` (ID: `admin`, PW: `password123`)

4.  **의존성 설치**
    ```bash
    npm install
    ```

5.  **애플리케이션 실행**
    ```bash
    # 개발 모드 (파일 변경 감지 및 자동 재시작)
    npm run start:dev

    # 프로덕션 모드
    npm run build
    npm run start:prod
    ```
    서버가 정상적으로 실행되면 콘솔에 `ExpertLink Server running on http://localhost:5700` 메시지가 출력됩니다.

---

## 5. API 엔드포인트 개요

자세한 API 명세는 Swagger나 Postman 등의 도구를 통해 확인하는 것을 권장합니다.

- `POST /auth/register`: 회원가입
- `POST /auth/login`: 로그인
- `GET /users/profile`: 내 프로필 조회
- `GET /experts`: 전문가 목록 검색
- `GET /experts/:id`: 전문가 상세 조회
- `POST /counselings`: 상담 신청
- `GET /counselings`: 내 상담 목록 조회
- `GET /contents`: 콘텐츠 목록 조회
- `POST /contents/:id/like`: 콘텐츠 좋아요
- `GET /chat/rooms`: 내 채팅방 목록 조회
- `GET /chat/rooms/:id/messages`: 채팅 메시지 조회

---

## 6. 주요 NPM 스크립트

- `npm run start`: 애플리케이션 실행
- `npm run start:dev`: 개발 모드로 실행
- `npm run build`: 프로덕션용으로 빌드
- `npm run format`: Prettier를 사용하여 코드 포맷팅
- `npm run lint`: ESLint를 사용하여 코드 검사 및 수정
- `npm test`: Jest를 사용하여 단위 테스트 실행
