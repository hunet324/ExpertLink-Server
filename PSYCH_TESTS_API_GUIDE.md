# 심리 설문 API 가이드

ExpertLink 서버의 심리 설문 관련 API 사용법을 안내합니다.

## 기본 정보

- **Base URL**: `${SERVER_BASE_URL}`
- **인증**: JWT 토큰 (일부 API는 선택사항)

## 📋 API 엔드포인트

### 1. 설문 목록 조회

**GET** `/psych-tests`

사용 가능한 심리 설문 목록을 조회합니다.

#### 인증
- 🔓 비로그인 사용자: 기본 정보만 조회
- 🔒 로그인 사용자: 완료 상태 정보 포함

#### 요청 예시

```bash
# 비로그인 사용자
GET /psych-tests

# 로그인 사용자 (완료 상태 포함)
GET /psych-tests
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 응답 예시

```json
[
  {
    "id": 1,
    "title": "스트레스 척도 검사",
    "description": "일상생활에서 느끼는 스트레스 정도를 측정하는 표준화된 검사입니다.",
    "logic_type": "scale",
    "estimated_time": 10,
    "instruction": "다음 문항들을 읽고 최근 2주간의 경험을 바탕으로 가장 적절한 답을 선택해주세요.",
    "questions_count": 10,
    "is_completed": true,
    "last_completed_at": "2024-01-15T14:30:00.000Z"
  },
  {
    "id": 2,
    "title": "간단한 성격 유형 검사 (MBTI)",
    "description": "16가지 성격 유형 중 나에게 가장 적합한 유형을 찾아보는 검사입니다.",
    "logic_type": "mbti",
    "estimated_time": 15,
    "instruction": "각 문항에서 두 선택지 중 자신에게 더 가까운 것을 선택해주세요.",
    "questions_count": 8,
    "is_completed": false,
    "last_completed_at": null
  }
]
```

### 2. 특정 설문 조회

**GET** `/psych-tests/:id`

특정 심리 설문의 상세 정보와 문항들을 조회합니다.

#### 인증
🔓 선택사항 (비로그인도 접근 가능)

#### 요청 예시

```bash
GET /psych-tests/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # 선택사항
```

#### 응답 예시

```json
{
  "id": 1,
  "title": "스트레스 척도 검사",
  "description": "일상생활에서 느끼는 스트레스 정도를 측정하는 표준화된 검사입니다.",
  "logic_type": "scale",
  "estimated_time": 10,
  "instruction": "다음 문항들을 읽고 최근 2주간의 경험을 바탕으로 가장 적절한 답을 선택해주세요.",
  "questions": [
    {
      "id": 1,
      "question": "최근 2주 동안 긴장감이나 스트레스를 얼마나 느꼈습니까?",
      "question_order": 1,
      "question_type": "scale",
      "options": [
        {"value": 0, "text": "전혀 없음", "score": 0},
        {"value": 1, "text": "약간", "score": 1},
        {"value": 2, "text": "보통", "score": 2},
        {"value": 3, "text": "상당히", "score": 3},
        {"value": 4, "text": "매우 심함", "score": 4}
      ],
      "is_required": true,
      "help_text": null
    }
  ],
  "scoring_rules": {"scoring_method": "sum", "reverse_questions": [2, 5, 8]},
  "result_ranges": {
    "낮음": {"min": 0, "max": 13, "description": "스트레스 수준이 낮습니다."},
    "보통": {"min": 14, "max": 26, "description": "평균적인 스트레스 수준입니다."},
    "높음": {"min": 27, "max": 40, "description": "스트레스 수준이 높습니다."}
  },
  "is_completed": false,
  "last_completed_at": null
}
```

### 3. 설문 응답 제출

**POST** `/psych-tests/:id/answers`

설문에 대한 답변을 제출하고 결과를 받습니다.

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
  "answers": [
    {
      "question_id": 1,
      "answer_value": "2"
    },
    {
      "question_id": 2,
      "answer_value": "1"
    },
    {
      "question_id": 3,
      "answer_value": "3"
    }
  ]
}
```

#### 요청 예시

```bash
POST /psych-tests/1/answers
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "answers": [
    {"question_id": 1, "answer_value": "2"},
    {"question_id": 2, "answer_value": "1"},
    {"question_id": 3, "answer_value": "3"},
    {"question_id": 4, "answer_value": "2"},
    {"question_id": 5, "answer_value": "0"},
    {"question_id": 6, "answer_value": "2"},
    {"question_id": 7, "answer_value": "1"},
    {"question_id": 8, "answer_value": "1"},
    {"question_id": 9, "answer_value": "1"},
    {"question_id": 10, "answer_value": "2"}
  ]
}
```

#### 응답 예시

**스트레스 척도 검사 결과:**
```json
{
  "message": "설문이 성공적으로 완료되었습니다.",
  "result_id": 123,
  "result_type": "보통",
  "result_description": "평균적인 스트레스 수준입니다. 적절한 휴식과 관리가 필요합니다.",
  "total_score": 16,
  "result_details": {
    "total_score": 16,
    "max_score": 40,
    "percentage": 40,
    "level": "보통"
  }
}
```

**MBTI 검사 결과:**
```json
{
  "message": "설문이 성공적으로 완료되었습니다.",
  "result_id": 124,
  "result_type": "ISFP",
  "result_description": "성인군자형 - 겸손하고 친근하며 예술적입니다.",
  "total_score": 0,
  "result_details": {
    "mbti_type": "ISFP",
    "dimensions": {
      "EI": {"E": 2, "I": 6},
      "SN": {"S": 5, "N": 3},
      "TF": {"T": 3, "F": 5},
      "JP": {"J": 3, "P": 5}
    }
  }
}
```

### 4. 내 설문 결과 조회

**GET** `/users/psych-results`

로그인한 사용자의 모든 심리 설문 결과를 조회합니다.

#### 인증
🔒 로그인 필수

#### 헤더
```
Authorization: Bearer <JWT_TOKEN>
```

#### 요청 예시

```bash
GET /users/psych-results
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 응답 예시

```json
[
  {
    "id": 123,
    "test_id": 1,
    "test_title": "스트레스 척도 검사",
    "total_score": 16,
    "result_type": "보통",
    "result_description": "평균적인 스트레스 수준입니다. 적절한 휴식과 관리가 필요합니다.",
    "result_details": {
      "total_score": 16,
      "max_score": 40,
      "percentage": 40,
      "level": "보통"
    },
    "completed_at": "2024-01-15T14:30:00.000Z"
  },
  {
    "id": 124,
    "test_id": 2,
    "test_title": "간단한 성격 유형 검사 (MBTI)",
    "total_score": 0,
    "result_type": "ISFP",
    "result_description": "성인군자형 - 겸손하고 친근하며 예술적입니다.",
    "result_details": {
      "mbti_type": "ISFP",
      "dimensions": {
        "EI": {"E": 2, "I": 6},
        "SN": {"S": 5, "N": 3},
        "TF": {"T": 3, "F": 5},
        "JP": {"J": 3, "P": 5}
      }
    },
    "completed_at": "2024-01-14T10:15:00.000Z"
  }
]
```

## 📊 설문 유형별 특징

### 1. SCALE (척도형)
- **특징**: 점수 기반 평가
- **예시**: 스트레스 척도, 우울 척도, 불안 척도
- **결과**: 총점을 기준으로 구간별 등급 (낮음/보통/높음)
- **활용**: 심리적 상태 수준 측정

### 2. MBTI (성격 유형)
- **특징**: 4개 차원의 이분법적 선택
- **예시**: Myers-Briggs 성격 유형
- **결과**: 16가지 성격 유형 중 하나 (ISFP, ENTJ 등)
- **활용**: 성격 특성 및 선호도 파악

### 3. CATEGORY (카테고리형)
- **특징**: 여러 카테고리 중 선호도 측정
- **예시**: 학습 스타일, 의사결정 유형
- **결과**: 가장 높은 빈도의 카테고리
- **활용**: 개인 선호도 및 스타일 분석

## 🎯 사용 시나리오

### 시나리오 1: 심리 건강 자가 진단

```bash
# 1. 사용 가능한 척도형 검사 확인
GET /psych-tests

# 2. 스트레스 척도 검사 실시
GET /psych-tests/1
POST /psych-tests/1/answers

# 3. 결과 확인 및 이력 관리
GET /users/psych-results
```

### 시나리오 2: 성격 유형 분석

```bash
# 1. MBTI 검사 조회
GET /psych-tests/2

# 2. 검사 실시
POST /psych-tests/2/answers

# 3. 결과 분석 및 저장
GET /users/psych-results
```

### 시나리오 3: 재검사 및 변화 추이

```bash
# 1. 이전 결과 확인
GET /users/psych-results

# 2. 동일 검사 재실시 (기존 결과는 업데이트됨)
POST /psych-tests/1/answers

# 3. 변화 추이 분석
GET /users/psych-results
```

## 🔐 인증 및 권한

### 비회원 사용자
- 설문 목록 조회: ✅ 가능
- 설문 상세 조회: ✅ 가능  
- 설문 응답 제출: ❌ 불가능
- 결과 조회: ❌ 불가능

### 로그인 사용자
- 모든 기능 접근 가능
- 개인화된 완료 상태 정보 제공
- 결과 저장 및 이력 관리

## ⚠️ 주의사항

### 답변 검증
- 모든 필수 문항에 답변해야 함
- 유효한 선택지만 허용
- 재검사 시 기존 답변 및 결과 업데이트

### 결과 해석
- 결과는 참고용으로만 사용
- 전문적 진단이 필요한 경우 전문가 상담 권장
- 개인차를 고려한 해석 필요

## 🛠️ 오류 응답

### 설문을 찾을 수 없는 경우
```json
{
  "statusCode": 404,
  "message": "설문을 찾을 수 없습니다.",
  "error": "Not Found"
}
```

### 답변이 불완전한 경우
```json
{
  "statusCode": 400,
  "message": "모든 문항에 답변해주세요. (8/10)",
  "error": "Bad Request"
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

이 API를 통해 다양한 심리 설문을 효과적으로 관리하고 사용자의 심리적 특성을 분석할 수 있습니다.