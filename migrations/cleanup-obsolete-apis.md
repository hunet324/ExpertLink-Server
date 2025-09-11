# 마이그레이션 후 불필요한 API 정리 가이드

## 1. 제거할 컨트롤러 및 모듈

### SchedulesModule 완전 제거
```bash
# 제거할 파일들
rm src/schedules/schedules.controller.ts
rm src/schedules/schedules.service.ts
rm src/schedules/schedules.module.ts
rm -rf src/schedules/dto/
```

**app.module.ts에서 제거:**
```typescript
// import { SchedulesModule } from './schedules/schedules.module'; // 제거
// SchedulesModule, // imports 배열에서 제거
```

### CounselingUnifiedController 제거
```bash
# 제거할 파일
rm src/counselings/counseling-unified.controller.ts
```

**counselings.module.ts에서 제거:**
```typescript
// CounselingUnifiedController 제거 (import와 controllers 배열에서)
```

## 2. 수정이 필요한 파일들

### experts.controller.ts
```typescript
// 제거할 import
// import { SchedulesService } from '../schedules/schedules.service';
// import { ScheduleResponseDto } from '../schedules/dto/schedule-response.dto';

// constructor에서 제거
// private readonly schedulesService: SchedulesService,

// 제거할 엔드포인트
// @Get(':expertId/schedules') - 전체 메서드 제거
// @Get('schedules/me') - 전체 메서드 제거
```

### experts.module.ts
```typescript
// SchedulesModule import 제거
```

### admin.controller.ts
```typescript
// 제거할 엔드포인트
// @Get('schedules') - 전체 메서드 제거  
// @Put('schedules/:id/cancel') - 전체 메서드 제거

// 대신 counselings 기반으로 재구현 필요
```

## 3. 엔티티 정리

### 제거할 엔티티
```sql
-- 데이터베이스에서 테이블 제거
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS counselings_unified CASCADE;
```

### 제거할 엔티티 파일
```bash
rm src/entities/schedule.entity.ts
rm src/entities/counseling-unified.entity.ts
```

## 4. DTO 정리

### 제거할 DTO
- `counseling-unified-response.dto.ts` (통합 후 불필요)
- 모든 schedule 관련 DTO들

### 유지할 DTO
- 새로 생성한 슬롯 관련 DTO들은 유지

## 5. 서비스 수정

### CounselingUnifiedService
- 필요한 메서드들을 CounselingsService로 이관
- 이관 완료 후 파일 제거

## 6. 클라이언트 영향도

### 프론트엔드 수정 필요 항목
1. `/schedules/*` 호출하는 모든 코드를 `/counselings/slots/*`로 변경
2. `/counselings-unified/*` 호출하는 코드를 `/counselings/*`로 변경
3. 전문가 일정 조회 API 경로 변경

### API 문서 업데이트
- Swagger 문서 자동 업데이트됨
- README 및 API 가이드 문서 수정 필요

## 7. 테스트 수정

### 제거할 테스트
- schedules 관련 모든 테스트
- counseling-unified 관련 모든 테스트

### 수정할 테스트
- counselings 테스트에 슬롯 관련 테스트 추가

## 8. 단계별 실행 계획

### Phase 1: 백업
```bash
# 코드 백업
git checkout -b backup/before-api-cleanup
git commit -am "Backup before removing obsolete APIs"
```

### Phase 2: 코드 정리
1. CounselingUnifiedService의 필요 메서드를 CounselingsService로 이관
2. 불필요한 컨트롤러 제거
3. 모듈에서 import 정리
4. 엔티티 파일 제거

### Phase 3: 데이터베이스 정리
```sql
-- 충분한 검증 후 실행
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS counselings_unified CASCADE;
```

### Phase 4: 테스트 및 검증
1. 모든 API 엔드포인트 테스트
2. 프론트엔드 연동 테스트
3. 성능 모니터링

## 9. 롤백 계획

문제 발생 시:
```bash
git checkout backup/before-api-cleanup
# 데이터베이스는 백업 테이블에서 복구
```

## 10. 예상 효과

1. **코드 간소화**: 중복 코드 제거로 유지보수성 향상
2. **성능 향상**: 불필요한 조인 제거
3. **API 일관성**: 하나의 통합된 API 체계
4. **데이터베이스 최적화**: 테이블 수 감소

---

**주의**: 프론트엔드와 충분한 협의 후 진행하세요!