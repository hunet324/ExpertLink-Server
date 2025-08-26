# 관리자 대시보드 API 가이드

ExpertLink 관리자 대시보드를 위한 API 엔드포인트 및 사용법 가이드입니다.

## 인증 요구사항

모든 관리자 API는 다음 인증이 필요합니다:
- JWT 토큰 인증 (Bearer 토큰)
- 관리자 권한 (`user_type: admin`)

```
Authorization: Bearer <jwt_token>
```

## API 엔드포인트

### 1. 대시보드 통계 조회

시스템 전체의 통계 정보를 조회합니다.

```http
GET /admin/stats
```

**응답 예시:**
```json
{
  "users": {
    "total_users": 1250,
    "active_users": 980,
    "pending_users": 45,
    "inactive_users": 225,
    "new_users_today": 12,
    "new_users_this_week": 89,
    "new_users_this_month": 245
  },
  "experts": {
    "total_experts": 156,
    "verified_experts": 134,
    "pending_verification": 22,
    "active_experts": 128,
    "average_rating": 4.5
  },
  "counselings": {
    "total_counselings": 3245,
    "completed_counselings": 2890,
    "pending_counselings": 245,
    "cancelled_counselings": 110,
    "counselings_today": 45,
    "counselings_this_week": 312,
    "counselings_this_month": 1234,
    "average_session_duration": 60
  },
  "contents": {
    "total_contents": 567,
    "published_contents": 489,
    "draft_contents": 78,
    "total_views": 125430,
    "total_likes": 8920,
    "most_viewed_content": {
      "id": 123,
      "title": "스트레스 관리법",
      "views": 2340
    }
  },
  "psych_tests": {
    "total_tests": 45,
    "active_tests": 38,
    "total_responses": 12450,
    "responses_today": 89,
    "responses_this_week": 634,
    "responses_this_month": 2340,
    "most_popular_test": {
      "id": 5,
      "title": "우울증 자가진단 테스트",
      "response_count": 3456
    }
  },
  "system": {
    "total_notifications": 25670,
    "unread_notifications": 1234,
    "chat_messages_today": 567,
    "login_sessions_today": 234,
    "server_uptime": "2592000 seconds",
    "database_size": "0 MB"
  },
  "generated_at": "2024-01-15T09:30:00Z"
}
```

### 2. 사용자 관리

#### 사용자 목록 조회

```http
GET /admin/users?page=1&limit=20&user_type=general&status=active&search=김&sort_by=created_at&sort_order=DESC
```

**쿼리 파라미터:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `user_type`: 사용자 유형 (`general`, `expert`, `admin`)
- `status`: 사용자 상태 (`pending`, `active`, `inactive`, `withdrawn`)
- `search`: 검색어 (이름 또는 이메일)
- `sort_by`: 정렬 기준 (`name`, `email`, `created_at`, `last_login`)
- `sort_order`: 정렬 순서 (`ASC`, `DESC`)

**응답 예시:**
```json
{
  "users": [
    {
      "id": 123,
      "name": "김철수",
      "email": "kim@example.com",
      "phone": "010-1234-5678",
      "user_type": "general",
      "status": "active",
      "profile_image": "https://example.com/image.jpg",
      "bio": "심리학에 관심이 많습니다.",
      "signup_date": "2024-01-10T08:00:00Z",
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "counseling_count": 5,
      "content_count": 2,
      "psych_test_count": 8,
      "is_verified": false
    }
  ],
  "total": 1250,
  "page": 1,
  "limit": 20,
  "total_pages": 63
}
```

#### 사용자 상태 변경

```http
PUT /admin/users/:id/status
```

**요청 본문:**
```json
{
  "status": "inactive",
  "reason": "이용약관 위반"
}
```

**응답 예시:**
```json
{
  "message": "사용자 상태가 성공적으로 변경되었습니다.",
  "user_id": 123,
  "old_status": "active",
  "new_status": "inactive",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### 3. 전문가 승인 관리

#### 승인 대기 전문가 목록 조회

```http
GET /admin/experts/pending
```

**응답 예시:**
```json
{
  "experts": [
    {
      "id": 45,
      "user_id": 234,
      "user_name": "이영희",
      "user_email": "lee@example.com",
      "specialization": ["불안장애", "우울증", "커플상담"],
      "license_number": "PS-2024-001",
      "license_type": "임상심리사 1급",
      "years_experience": 5,
      "education": "서울대학교 심리학과 박사",
      "career_history": "○○병원 정신건강의학과 5년 근무",
      "introduction": "다년간의 임상 경험으로 내담자의 마음을 헤아립니다.",
      "hourly_rate": 80000,
      "created_at": "2024-01-10T09:00:00Z",
      "verification_documents": []
    }
  ],
  "total": 22,
  "pending_count": 22
}
```

#### 전문가 종합 정보 수정

전문가의 기본 사용자 정보와 프로필 정보를 한 번에 수정합니다.

```http
PUT /admin/experts/:id/profile
```

**요청 본문:**
```json
{
  "name": "김전문가",
  "phone": "010-1234-5678",
  "status": "active",
  "centerId": 1,
  "licenseNumber": "PSY-2023-001234",
  "licenseType": "상담심리사 1급",
  "yearsExperience": 5,
  "hourlyRate": 80000,
  "specialization": ["우울증", "불안장애", "부부상담"],
  "introduction": "10년 경력의 전문 상담사입니다.",
  "education": "서울대학교 심리학과 박사",
  "careerHistory": "서울대병원 정신건강의학과 5년 근무"
}
```

**참고**: 모든 필드는 선택사항(optional)입니다. 제공된 필드만 업데이트됩니다.

**응답 예시:**
```json
{
  "message": "전문가 정보가 성공적으로 업데이트되었습니다.",
  "expert_id": 234,
  "expert_name": "김전문가",
  "updated_fields": {
    "user_fields": ["name", "phone", "status", "center_id"],
    "expert_fields": ["license_number", "license_type", "years_experience", "hourly_rate", "specialization", "introduction"]
  },
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### 전문가 승인/거절

```http
PUT /admin/experts/:id/verify
```

**요청 본문:**
```json
{
  "is_verified": true,
  "verification_note": "모든 서류가 확인되어 승인합니다."
}
```

**응답 예시:**
```json
{
  "message": "전문가가 승인되었습니다.",
  "expert_id": 45,
  "expert_name": "이영희",
  "is_verified": true,
  "verification_note": "모든 서류가 확인되어 승인합니다.",
  "verification_date": "2024-01-15T10:30:00Z",
  "verified_by": 1
}
```

## 오류 처리

### 일반적인 오류 응답

```json
{
  "statusCode": 400,
  "message": "잘못된 요청입니다.",
  "error": "Bad Request"
}
```

### HTTP 상태 코드

- `200 OK`: 성공
- `400 Bad Request`: 잘못된 요청
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 없음 (관리자가 아님)
- `404 Not Found`: 리소스를 찾을 수 없음
- `500 Internal Server Error`: 서버 오류

## 관리자 권한 설정

관리자 권한을 가진 사용자만 이 API들에 접근할 수 있습니다. 사용자를 관리자로 설정하려면:

1. 데이터베이스에서 직접 `user_type`을 `admin`으로 변경
2. 또는 기존 관리자가 다른 사용자를 관리자로 승격

```sql
UPDATE users SET user_type = 'admin' WHERE id = <user_id>;
```

## 사용 예시

### JavaScript/Node.js
```javascript
const axios = require('axios');

// JWT 토큰을 헤더에 포함하여 요청
const config = {
  headers: { 
    Authorization: `Bearer ${jwtToken}` 
  }
};

// 대시보드 통계 조회
const stats = await axios.get('/admin/stats', config);
console.log(stats.data);

// 사용자 목록 조회
const users = await axios.get('/admin/users?page=1&limit=20', config);
console.log(users.data);

// 사용자 상태 변경
await axios.put('/admin/users/123/status', {
  status: 'inactive',
  reason: '이용약관 위반'
}, config);

// 전문가 종합 정보 수정
await axios.put('/admin/experts/234/profile', {
  name: '김전문가',
  phone: '010-1234-5678',
  status: 'active',
  centerId: 1,
  licenseNumber: 'PSY-2023-001234',
  licenseType: '상담심리사 1급',
  yearsExperience: 5,
  hourlyRate: 80000,
  specialization: ['우울증', '불안장애', '부부상담'],
  introduction: '10년 경력의 전문 상담사입니다.'
}, config);

// 전문가 승인
await axios.put('/admin/experts/45/verify', {
  is_verified: true,
  verification_note: '승인 완료'
}, config);
```

### cURL
```bash
# 대시보드 통계 조회
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:${PORT}/admin/stats

# 사용자 목록 조회
curl -H "Authorization: Bearer <jwt_token>" \
     "http://localhost:${PORT}/admin/users?page=1&limit=20"

# 사용자 상태 변경
curl -X PUT \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"status": "inactive", "reason": "이용약관 위반"}' \
     http://localhost:${PORT}/admin/users/123/status

# 전문가 종합 정보 수정
curl -X PUT \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "김전문가",
       "phone": "010-1234-5678",
       "status": "active",
       "centerId": 1,
       "licenseNumber": "PSY-2023-001234",
       "licenseType": "상담심리사 1급",
       "yearsExperience": 5,
       "hourlyRate": 80000,
       "specialization": ["우울증", "불안장애", "부부상담"],
       "introduction": "10년 경력의 전문 상담사입니다."
     }' \
     http://localhost:${PORT}/admin/experts/234/profile

# 전문가 승인
curl -X PUT \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"is_verified": true, "verification_note": "승인 완료"}' \
     http://localhost:${PORT}/admin/experts/45/verify
```

## 주의사항

1. **권한 관리**: 관리자 권한은 신중하게 부여해야 합니다.
2. **데이터 보호**: 개인정보가 포함된 API이므로 HTTPS 사용을 권장합니다.
3. **로깅**: 관리자 활동은 별도로 로깅하여 추적할 수 있도록 구현하는 것을 권장합니다.
4. **백업**: 사용자 상태 변경 등 중요한 작업 전에는 데이터 백업을 권장합니다.

## 추가 기능 제안

향후 추가할 수 있는 관리자 기능들:

1. **컨텐츠 관리**: 게시물 승인/거절, 신고 처리
2. **상담 관리**: 상담 세션 모니터링, 분쟁 조정
3. **결제 관리**: 결제 내역, 환불 처리
4. **시스템 설정**: 앱 설정, 공지사항 관리
5. **보고서 생성**: Excel/PDF 형태의 통계 보고서 다운로드

이 API 가이드는 관리자 대시보드 구현을 위한 기본적인 기능들을 제공합니다. 실제 운영 시에는 보안과 사용성을 더욱 강화하여 구현하시기 바랍니다.