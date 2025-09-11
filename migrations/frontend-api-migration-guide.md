# 프론트엔드 API 마이그레이션 가이드

## 📋 개요
백엔드 API 통합으로 인해 프론트엔드에서 수정이 필요한 API 호출들을 정리했습니다.

## 🔄 주요 변경사항

### 1. **API 경로 변경**

#### `/counselings-unified/*` → `/counselings/*`
```typescript
// 기존 (변경 전)
'/counselings-unified/expert/all' → '/counselings/expert/all'
'/counselings-unified/expert/today' → '/counselings/expert/today'
'/counselings-unified/expert/chat/active-upcoming' → '/counselings/expert/chat/active-upcoming'
'/counselings-unified/expert/chat/completed' → '/counselings/expert/chat/completed'
'/counselings-unified/expert/chat/expired' → '/counselings/expert/chat/expired'
'/counselings-unified/expert/video/active-upcoming' → '/counselings/expert/video/active-upcoming'
'/counselings-unified/expert/video/completed' → '/counselings/expert/video/completed'
'/counselings-unified/expert/video/expired' → '/counselings/expert/video/expired'

// 새로운 슬롯 관련 API
'/counselings/slots' (POST) - 가용 슬롯 생성
'/counselings/slots/available/:expertId' (GET) - 예약 가능 슬롯 조회
'/counselings/slots/:slotId/book' (POST) - 슬롯 예약
```

#### `/schedules/*` → `/counselings/*` 또는 제거
```typescript
// 기존 (변경 전) → 새로운 경로
'/schedules/my' → '/counselings/expert/all'
'/schedules/today' → '/counselings/expert/today'
'/schedules/today/detailed' → '/counselings/expert/today'
'/schedules' (POST) → '/counselings/slots' (POST)
'/schedules/:id' (PUT/DELETE) → 슬롯 관리 API로 변경

// 전문가별 일정 조회
'/experts/:expertId/schedules' → '/experts/:expertId/available-slots'
'/experts/schedules/me' → '/experts/counselings/me'

// 관리자 일정 관리
'/admin/schedules' → '/admin/counselings'
'/admin/schedules/:id/cancel' → '/admin/counselings/:id/cancel'
```

## 📁 수정이 필요한 파일들

### 1. **서비스 파일 수정**

#### `/src/services/counseling-unified.ts`
```typescript
// 모든 API 경로를 /counselings-unified → /counselings로 변경
export const counselingUnifiedService = {
  async getExpertAllSchedules(): Promise<CounselingUnifiedResponse[]> {
    // 변경 전: '/counselings-unified/expert/all'
    // 변경 후: '/counselings/expert/all'
    const response = await apiClient.get<CounselingUnifiedResponse[]>('/counselings/expert/all');
    return response;
  },

  async getExpertTodaySchedules(): Promise<CounselingUnifiedResponse[]> {
    // 변경 전: '/counselings-unified/expert/today'
    // 변경 후: '/counselings/expert/today'
    const response = await apiClient.get<CounselingUnifiedResponse[]>('/counselings/expert/today');
    return response;
  },

  // 새로운 슬롯 관리 메서드 추가
  async createAvailableSlots(slots: CreateSlotDto[]): Promise<CounselingUnifiedResponse[]> {
    const response = await apiClient.post<CounselingUnifiedResponse[]>('/counselings/slots', { slots });
    return response;
  },

  async getAvailableSlots(expertId: number, date?: string): Promise<CounselingUnifiedResponse[]> {
    const queryString = date ? `?date=${date}` : '';
    const response = await apiClient.get<CounselingUnifiedResponse[]>(`/counselings/slots/available/${expertId}${queryString}`);
    return response;
  },

  async bookSlot(slotId: number, reason: string): Promise<CounselingUnifiedResponse> {
    const response = await apiClient.post<CounselingUnifiedResponse>(`/counselings/slots/${slotId}/book`, { reason });
    return response;
  },

  // 기타 모든 API 경로 업데이트...
};
```

#### `/src/services/expert.ts`
```typescript
export const expertService = {
  // 기존 schedules 관련 메서드들을 counselings로 변경
  async getMySchedules(): Promise<any[]> {
    // 변경 전: '/schedules/my'
    // 변경 후: '/counselings/expert/all'
    const response = await apiClient.get<any[]>('/counselings/expert/all');
    return response;
  },

  async getTodaySchedules(): Promise<TodaySchedule[]> {
    // 변경 전: '/schedules/today'
    // 변경 후: '/counselings/expert/today'
    const response = await apiClient.get<TodaySchedule[]>('/counselings/expert/today');
    return response;
  },

  async getTodayDetailedSchedules(): Promise<any[]> {
    // 변경 전: '/schedules/today/detailed'
    // 변경 후: '/counselings/expert/today'
    const response = await apiClient.get<any[]>('/counselings/expert/today');
    return response;
  },

  // 새로운 슬롯 관리 메서드들
  async createAvailableSlots(slots: any[]): Promise<any[]> {
    const response = await apiClient.post<any[]>('/counselings/slots', { slots });
    return response;
  },

  // schedules CRUD 메서드들 제거 또는 슬롯 관리로 변경
  // createSchedule, updateSchedule, deleteSchedule, getScheduleDetail 등
};
```

#### `/src/services/admin.ts`
```typescript
export const adminService = {
  // 일정 관리 → 상담 관리로 변경
  async getScheduleStats(centerId?: number): Promise<ScheduleStats> {
    // 변경 전: '/admin/schedules'
    // 변경 후: '/admin/counselings'
    const queryString = centerId ? `?center_id=${centerId}` : '';
    const response = await apiClient.get<ScheduleStats>(`/admin/counselings${queryString}`);
    return response;
  },

  async cancelSchedule(scheduleId: number): Promise<{ success: boolean; message: string }> {
    // 변경 전: '/admin/schedules/:id/cancel'
    // 변경 후: '/admin/counselings/:id/cancel'
    const response = await apiClient.put<{ success: boolean; message: string }>(`/admin/counselings/${scheduleId}/cancel`);
    return response;
  },
};
```

### 2. **컴포넌트 파일 수정**

다음 페이지들에서 API 호출 업데이트가 필요합니다:

#### 전문가 대시보드 관련
- `/pages/expert/dashboard.tsx`
- `/pages/expert/dashboard/schedule.tsx`
- `/pages/expert/schedule/daily/[date].tsx`
- `/pages/expert/clients/calendar.tsx`

#### 상담 관련
- `/pages/expert/counseling/chat.tsx`
- `/pages/expert/counseling/video.tsx`
- `/pages/expert/counseling/prepare/[id].tsx`

#### 관리자 페이지
- `/pages/admin/experts/schedule.tsx`
- `/pages/admin/experts/[expertId]/schedule/[scheduleId].tsx`

### 3. **데이터 타입 업데이트**

#### 새로운 타입 정의
```typescript
// 슬롯 생성 요청 타입
export interface CreateSlotDto {
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:MM:SS
  endTime: string;        // HH:MM:SS
  duration?: number;      // 기본값: 60분
  type?: 'video' | 'chat' | 'voice';  // 기본값: 'video'
  title?: string;
}

// 슬롯 예약 요청 타입
export interface BookSlotDto {
  reason: string;
}

// 기존 CounselingUnifiedResponse 타입 유지 (필드명 일부 변경 필요)
export interface CounselingResponse {
  id: number;
  userId?: number;        // clientId → userId
  expertId: number;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  type: 'video' | 'chat' | 'voice';
  status: 'available' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
  title?: string;
  reason?: string;
  notes?: string;
  
  // 세션 정보
  sessionNotes?: string;
  userFeedback?: string;
  rating?: number;
  actualStartTime?: string;
  actualEndTime?: string;
  
  // 결제 정보
  paymentAmount?: number;
  paymentStatus: string;
  
  // 메타 정보
  createdAt: string;
  updatedAt: string;
}
```

## 🔄 마이그레이션 단계

### 1단계: 서비스 파일 업데이트
1. `counseling-unified.ts`의 모든 API 경로 변경
2. `expert.ts`의 schedules 관련 메서드 업데이트
3. `admin.ts`의 schedules 관련 메서드 업데이트

### 2단계: 타입 정의 업데이트
1. 새로운 슬롯 관련 타입 추가
2. 기존 타입의 필드명 변경사항 반영

### 3단계: 컴포넌트 업데이트
1. 전문가 대시보드 및 일정 관련 페이지
2. 상담 관련 페이지
3. 관리자 페이지

### 4단계: 테스트 및 검증
1. 각 페이지별 기능 테스트
2. API 호출 로그 확인
3. 에러 처리 검증

## ⚠️ 주의사항

1. **점진적 마이그레이션**: 한 번에 모든 것을 변경하지 말고 단계별로 진행
2. **백엔드 확인**: 백엔드 API가 완전히 배포된 후 프론트엔드 업데이트
3. **에러 핸들링**: 기존 API 호출이 실패할 경우 대비책 마련
4. **테스트 환경**: 개발 환경에서 충분히 테스트 후 배포

## 🔧 유틸리티 함수

기존 API와의 호환성을 위한 어댑터 함수:

```typescript
// API 호환성 어댑터
export const apiMigrationAdapter = {
  // 기존 schedules API 호출을 새 API로 변환
  async legacyScheduleToSlot(scheduleData: any) {
    return {
      date: scheduleData.scheduleDate,
      startTime: scheduleData.startTime,
      endTime: scheduleData.endTime,
      duration: scheduleData.duration || 60,
      type: scheduleData.type || 'video',
      title: scheduleData.title
    };
  },

  // 응답 데이터 형식 변환
  convertResponseFormat(counselingData: any) {
    return {
      ...counselingData,
      clientId: counselingData.userId,  // 호환성을 위한 필드명 매핑
      scheduleTime: counselingData.startTime,
      // 기타 필요한 변환...
    };
  }
};
```

---

**🚨 중요**: 모든 변경사항은 백엔드 API 배포가 완료된 후에 진행하세요!