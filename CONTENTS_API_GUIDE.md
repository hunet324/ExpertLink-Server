# 심리 콘텐츠 API 가이드

ExpertLink 서버의 심리 콘텐츠 관련 API 사용법을 안내합니다.

## 기본 정보

- **Base URL**: `${SERVER_BASE_URL}`
- **인증**: JWT 토큰 (일부 API는 선택사항)

## 📚 API 엔드포인트

### 1. 콘텐츠 목록 조회

**GET** `/contents`

콘텐츠 목록을 필터링과 페이지네이션으로 조회합니다.

#### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `content_type` | string | ❌ | 콘텐츠 타입 | `article`, `video`, `meditation` |
| `category` | string | ❌ | 카테고리 | `stress`, `depression`, `sleep` |
| `search` | string | ❌ | 검색어 (제목, 요약, 태그) | `스트레스` |
| `is_featured` | boolean | ❌ | 추천 콘텐츠 여부 | `true`, `false` |
| `is_premium` | boolean | ❌ | 프리미엄 콘텐츠 여부 | `true`, `false` |
| `tags` | string | ❌ | 태그 (쉼표 구분) | `호흡법,명상,릴렉스` |
| `sort_by` | string | ❌ | 정렬 기준 | `latest`, `popular`, `views`, `likes` |
| `page` | number | ❌ | 페이지 번호 (기본: 1) | `1` |
| `limit` | number | ❌ | 페이지 크기 (기본: 10) | `20` |

#### 요청 예시

```bash
# 기본 목록 조회
GET /contents

# 스트레스 관련 아티클만 조회
GET /contents?category=stress&content_type=article

# 추천 콘텐츠, 인기순 정렬
GET /contents?is_featured=true&sort_by=popular&limit=5

# 명상 관련 태그 검색
GET /contents?tags=명상,호흡법&sort_by=latest
```

#### 응답 예시

```json
{
  "contents": [
    {
      "id": 1,
      "title": "스트레스 관리의 첫 걸음: 호흡법",
      "summary": "일상에서 쉽게 실천할 수 있는 호흡법을 통해 스트레스를 효과적으로 관리하는 방법을 알아보세요.",
      "content_type": "article",
      "category": "stress",
      "thumbnail_url": "https://example.com/thumbnails/breathing.jpg",
      "tags": ["호흡법", "스트레스", "명상", "릴렉스"],
      "reading_time": 5,
      "view_count": 234,
      "like_count": 45,
      "bookmark_count": 23,
      "author_name": "김심리 전문가",
      "is_featured": true,
      "is_premium": false,
      "published_at": "2024-01-15T09:00:00.000Z",
      "is_liked": true,
      "is_bookmarked": false
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

### 2. 콘텐츠 상세 조회

**GET** `/contents/:id`

특정 콘텐츠의 상세 정보를 조회합니다. (조회수 자동 증가)

#### 요청 예시

```bash
GET /contents/1
```

#### 응답 예시

```json
{
  "id": 1,
  "title": "스트레스 관리의 첫 걸음: 호흡법",
  "summary": "일상에서 쉽게 실천할 수 있는 호흡법을 통해 스트레스를 효과적으로 관리하는 방법을 알아보세요.",
  "content": "스트레스는 현대인의 피할 수 없는 동반자입니다. 하지만 올바른 호흡법을 통해...",
  "content_type": "article",
  "category": "stress",
  "status": "published",
  "thumbnail_url": "https://example.com/thumbnails/breathing.jpg",
  "media_url": null,
  "tags": ["호흡법", "스트레스", "명상", "릴렉스"],
  "reading_time": 5,
  "view_count": 235,
  "like_count": 45,
  "bookmark_count": 23,
  "author_id": 1,
  "author_name": "김심리 전문가",
  "metadata": {},
  "is_featured": true,
  "is_premium": false,
  "published_at": "2024-01-15T09:00:00.000Z",
  "created_at": "2024-01-15T09:00:00.000Z",
  "updated_at": "2024-01-15T09:00:00.000Z",
  "is_liked": true,
  "is_bookmarked": false
}
```

### 3. 좋아요 토글

**POST** `/contents/:id/like`

콘텐츠에 좋아요를 추가하거나 취소합니다.

**🔒 인증 필요**

#### 헤더
```
Authorization: Bearer <JWT_TOKEN>
```

#### 요청 예시

```bash
POST /contents/1/like
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 응답 예시

```json
{
  "message": "좋아요를 눌렀습니다.",
  "isLiked": true,
  "likeCount": 46
}
```

```json
{
  "message": "좋아요를 취소했습니다.",
  "isLiked": false,
  "likeCount": 45
}
```

### 4. 북마크 토글

**POST** `/contents/:id/bookmark`

콘텐츠를 북마크에 추가하거나 제거합니다.

**🔒 인증 필요**

#### 헤더
```
Authorization: Bearer <JWT_TOKEN>
```

#### 요청 예시

```bash
POST /contents/1/bookmark
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 응답 예시

```json
{
  "message": "북마크에 추가했습니다.",
  "isBookmarked": true,
  "bookmarkCount": 24
}
```

## 🎯 사용 시나리오

### 시나리오 1: 메인 화면 구성

```bash
# 1. 추천 콘텐츠 (상위 3개)
GET /contents?is_featured=true&sort_by=popular&limit=3

# 2. 최신 콘텐츠 (상위 5개)
GET /contents?sort_by=latest&limit=5

# 3. 인기 콘텐츠 (상위 5개)
GET /contents?sort_by=popular&limit=5
```

### 시나리오 2: 카테고리별 탐색

```bash
# 스트레스 관리 콘텐츠
GET /contents?category=stress&sort_by=popular

# 수면 관련 명상 콘텐츠
GET /contents?category=sleep&content_type=meditation

# 우울감 관련 아티클
GET /contents?category=depression&content_type=article
```

### 시나리오 3: 검색 기능

```bash
# 키워드 검색
GET /contents?search=호흡법&sort_by=latest

# 태그 기반 검색
GET /contents?tags=명상,릴렉스&sort_by=popular

# 복합 검색 (카테고리 + 태그)
GET /contents?category=stress&tags=호흡법&sort_by=views
```

## 📊 콘텐츠 타입 및 카테고리

### 콘텐츠 타입 (`content_type`)
- `article`: 글 형태의 콘텐츠
- `video`: 비디오 콘텐츠
- `audio`: 오디오 콘텐츠 
- `infographic`: 인포그래픽
- `quiz`: 심리 퀴즈
- `meditation`: 명상 가이드
- `exercise`: 심리 운동/훈련

### 카테고리 (`category`)
- `depression`: 우울
- `anxiety`: 불안
- `stress`: 스트레스
- `relationship`: 인간관계
- `self_esteem`: 자존감
- `sleep`: 수면
- `addiction`: 중독
- `trauma`: 트라우마
- `parenting`: 육아
- `workplace`: 직장
- `general`: 일반

## 🔑 인증 관련

### 비회원 접근
- 콘텐츠 목록 조회: ✅ 가능
- 콘텐츠 상세 조회: ✅ 가능
- 좋아요/북마크: ❌ 로그인 필요

### 로그인 사용자
- 모든 기능 접근 가능
- 개인화된 정보 제공 (is_liked, is_bookmarked)
- 프리미엄 콘텐츠 접근 (구독 상태에 따라)

## ⚠️ 에러 응답

```json
{
  "statusCode": 404,
  "message": "콘텐츠를 찾을 수 없습니다.",
  "error": "Not Found"
}
```

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "인증이 필요합니다."
}
```

이 API를 통해 다양한 심리 콘텐츠를 효과적으로 관리하고 사용자에게 제공할 수 있습니다.