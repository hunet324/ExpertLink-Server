# 알림 API 가이드

ExpertLink 서버의 알림 관련 API 사용법을 안내합니다.

## 기본 정보

- **Base URL**: `${SERVER_BASE_URL}`
- **인증**: JWT 토큰 필수 (모든 알림 API)

## 🔔 API 엔드포인트

### 1. 알림 목록 조회

**GET** `/notifications`

사용자의 알림 목록을 조회합니다.

#### 인증
🔒 로그인 필수

#### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `type` | string | ❌ | 알림 유형 필터 | `counseling`, `content`, `system` |
| `is_read` | boolean | ❌ | 읽음 상태 필터 | `true`, `false` |
| `page` | number | ❌ | 페이지 번호 (기본: 1) | `1` |
| `limit` | number | ❌ | 페이지 크기 (기본: 20) | `50` |

#### 헤더
```
Authorization: Bearer <JWT_TOKEN>
```

#### 요청 예시

```bash
# 모든 알림 조회
GET /notifications
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 읽지 않은 알림만 조회
GET /notifications?is_read=false

# 상담 관련 알림만 조회
GET /notifications?type=counseling&limit=10

# 첫 번째 페이지, 50개씩 조회
GET /notifications?page=1&limit=50
```

#### 응답 예시

```json
{
  "notifications": [
    {
      "id": 123,
      "title": "상담 예약이 승인되었습니다",
      "message": "박전문가님과의 상담이 2024년 1월 20일 오후 2시에 확정되었습니다.",
      "type": "counseling",
      "reference_id": 1,
      "is_read": false,
      "metadata": {
        "action_url": "/counselings/1",
        "icon": "calendar",
        "priority": "high"
      },
      "created_at": "2024-01-15T14:30:00.000Z",
      "time_ago": "2시간 전"
    },
    {
      "id": 124,
      "title": "새로운 심리 콘텐츠가 업데이트되었습니다",
      "message": "스트레스 관리에 대한 새로운 가이드가 업로드되었습니다.",
      "type": "content",
      "reference_id": 5,
      "is_read": true,
      "metadata": {
        "action_url": "/contents/5",
        "icon": "article",
        "category": "stress"
      },
      "created_at": "2024-01-14T10:15:00.000Z",
      "time_ago": "1일 전"
    }
  ],
  "total": 25,
  "unread_count": 8,
  "page": 1,
  "limit": 20,
  "total_pages": 2
}
```

### 2. 알림 통계 조회

**GET** `/notifications/stats`

사용자의 알림 통계 정보를 조회합니다.

#### 인증
🔒 로그인 필수

#### 요청 예시

```bash
GET /notifications/stats
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 응답 예시

```json
{
  "total_count": 25,
  "unread_count": 8,
  "read_count": 17,
  "today_count": 3
}
```

### 3. 알림 읽음 처리

**PUT** `/notifications/:id/read`

특정 알림을 읽음으로 표시합니다.

#### 인증
🔒 로그인 필수

#### 헤더
```
Authorization: Bearer <JWT_TOKEN>
```

#### 요청 예시

```bash
PUT /notifications/123/read
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 응답 예시

```json
{
  "message": "알림을 읽음으로 처리했습니다.",
  "is_read": true,
  "updated_at": "2024-01-15T16:45:00.000Z"
}
```

**이미 읽은 알림의 경우:**
```json
{
  "message": "이미 읽은 알림입니다.",
  "is_read": true,
  "updated_at": "2024-01-15T14:30:00.000Z"
}
```

### 4. 알림 삭제

**DELETE** `/notifications/:id`

특정 알림을 삭제합니다.

#### 인증
🔒 로그인 필수

#### 헤더
```
Authorization: Bearer <JWT_TOKEN>
```

#### 요청 예시

```bash
DELETE /notifications/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 응답 예시

```json
{
  "message": "알림이 삭제되었습니다.",
  "deleted_id": 123
}
```

### 5. 일괄 처리 (추가 기능)

**POST** `/notifications/bulk-action`

여러 알림을 한 번에 처리합니다.

#### 인증
🔒 로그인 필수

#### 헤더
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### 요청 바디

```json
{
  "action": "read",  // "read" 또는 "delete"
  "notification_ids": [123, 124, 125]  // 특정 알림들 (생략 시 전체)
}
```

#### 요청 예시

```bash
# 특정 알림들을 읽음으로 처리
POST /notifications/bulk-action
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "action": "read",
  "notification_ids": [123, 124, 125]
}

# 모든 읽지 않은 알림을 읽음으로 처리
POST /notifications/bulk-action
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "action": "read"
}

# 특정 알림들을 삭제
POST /notifications/bulk-action
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "action": "delete",
  "notification_ids": [126, 127]
}
```

#### 응답 예시

```json
{
  "message": "3개의 알림을 읽음으로 처리했습니다.",
  "affected_count": 3,
  "action": "read"
}
```

## 📋 알림 유형 (type)

### 기본 알림 유형
- `counseling`: 상담 관련 알림 (예약, 승인, 리마인더)
- `schedule`: 일정 관련 알림 (새 일정, 변경사항)
- `content`: 콘텐츠 관련 알림 (새 글, 추천)
- `system`: 시스템 알림 (공지, 업데이트, 이벤트)
- `chat`: 채팅 메시지 알림
- `psych_test`: 심리 검사 관련 알림 (결과, 추천 검사)

### 우선순위별 분류
- **urgent**: 즉시 확인 필요 (상담 시작 알림 등)
- **high**: 중요 알림 (예약 승인, 일정 변경)
- **normal**: 일반 알림 (새 콘텐츠, 추천)
- **low**: 참고용 알림 (통계, 이벤트)

## 🎯 사용 시나리오

### 시나리오 1: 알림 센터 구현

```bash
# 1. 알림 통계 확인 (뱃지 표시용)
GET /notifications/stats

# 2. 최근 알림 목록 (읽지 않은 것 우선)
GET /notifications?limit=10

# 3. 특정 알림 읽음 처리
PUT /notifications/123/read
```

### 시나리오 2: 알림 관리 화면

```bash
# 1. 페이지네이션된 전체 알림
GET /notifications?page=1&limit=20

# 2. 유형별 필터링
GET /notifications?type=counseling&is_read=false

# 3. 모든 알림 읽음 처리
POST /notifications/bulk-action
{
  "action": "read"
}

# 4. 선택된 알림들 삭제
POST /notifications/bulk-action
{
  "action": "delete",
  "notification_ids": [123, 124, 125]
}
```

### 시나리오 3: 실시간 알림 처리

```bash
# 1. 최신 읽지 않은 알림만 조회
GET /notifications?is_read=false&limit=5

# 2. 알림 확인 후 읽음 처리
PUT /notifications/123/read

# 3. 불필요한 알림 삭제
DELETE /notifications/124
```

## 📊 메타데이터 (metadata) 활용

### 액션 버튼이 있는 알림
```json
{
  "metadata": {
    "action_url": "/counselings/1",
    "action_text": "상담 확인",
    "icon": "calendar",
    "priority": "high"
  }
}
```

### 이벤트 알림
```json
{
  "metadata": {
    "action_url": "/events/mental-health-month",
    "icon": "event",
    "event_end": "2024-01-31",
    "reward": "무료 상담"
  }
}
```

### 채팅 메시지 알림
```json
{
  "metadata": {
    "action_url": "/chat/rooms/1",
    "icon": "message",
    "sender": "박전문가",
    "preview": "안녕하세요. 상담 준비는..."
  }
}
```

## 🔔 실시간 알림 구현 권장사항

### 1. 폴링 방식
```javascript
// 30초마다 새 알림 확인
setInterval(() => {
  fetch('/notifications/stats')
    .then(response => response.json())
    .then(data => {
      updateNotificationBadge(data.unread_count);
    });
}, 30000);
```

### 2. WebSocket 방식 (추후 구현)
```javascript
// 실시간 알림 수신
socket.on('new_notification', (notification) => {
  showNotificationPopup(notification);
  updateNotificationList();
});
```

### 3. 브라우저 알림
```javascript
// 브라우저 푸시 알림
if (notification.metadata.priority === 'urgent') {
  new Notification(notification.title, {
    body: notification.message,
    icon: '/icons/notification.png'
  });
}
```

## ⚠️ 오류 응답

### 알림을 찾을 수 없는 경우
```json
{
  "statusCode": 404,
  "message": "알림을 찾을 수 없습니다.",
  "error": "Not Found"
}
```

### 권한이 없는 경우
```json
{
  "statusCode": 403,
  "message": "해당 알림에 대한 권한이 없습니다.",
  "error": "Forbidden"
}
```

### 인증이 필요한 경우
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "인증이 필요합니다."
}
```

## 💡 모범 사례

1. **읽지 않은 알림 우선 표시**: `is_read=false`로 필터링
2. **적절한 페이지 크기**: 모바일은 10-20개, 웹은 20-50개
3. **시간 표시**: `time_ago` 필드 활용으로 사용자 친화적 표시
4. **메타데이터 활용**: 알림별 맞춤 액션 버튼 구현
5. **일괄 처리**: 사용자 편의를 위한 "모두 읽음" 기능

이 API를 통해 효과적인 알림 시스템을 구현하여 사용자 경험을 향상시킬 수 있습니다.