-- =====================================================
-- Counselings 테이블 통합 마이그레이션 검증 스크립트
-- 작성일: 2025-09-10
-- 목적: 마이그레이션 후 데이터 무결성 및 기능 검증
-- =====================================================

-- 1. 기본 통계 확인
SELECT 
  '=== 마이그레이션 통계 ===' as title;

SELECT 
  'Original counselings' as source, 
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT expert_id) as unique_experts
FROM counselings_backup
UNION ALL
SELECT 
  'Counselings unified' as source, 
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT expert_id) as unique_experts
FROM counselings_unified_backup
UNION ALL
SELECT 
  'Migrated counselings' as source, 
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT expert_id) as unique_experts
FROM counselings;

-- 2. 가용 슬롯 vs 예약된 세션 통계
SELECT 
  '=== 슬롯 타입별 통계 ===' as title;

SELECT 
  CASE 
    WHEN user_id IS NULL THEN 'Available Slots'
    ELSE 'Booked Sessions'
  END as type,
  COUNT(*) as count,
  COUNT(DISTINCT expert_id) as experts
FROM counselings
GROUP BY (user_id IS NULL);

-- 3. 상태별 분포
SELECT 
  '=== 상태별 분포 ===' as title;

SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as available_slots,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as booked_sessions
FROM counselings
GROUP BY status
ORDER BY count DESC;

-- 4. 날짜/시간 필드 검증
SELECT 
  '=== 날짜/시간 필드 검증 ===' as title;

SELECT 
  COUNT(*) as total_records,
  COUNT(schedule_date) as has_schedule_date,
  COUNT(start_time) as has_start_time,
  COUNT(end_time) as has_end_time,
  COUNT(duration) as has_duration,
  COUNT(appointment_date) as has_appointment_date
FROM counselings;

-- 5. 중복 데이터 체크
SELECT 
  '=== 중복 가능성 체크 ===' as title;

WITH duplicates AS (
  SELECT 
    user_id,
    expert_id,
    schedule_date,
    start_time,
    COUNT(*) as duplicate_count
  FROM counselings
  WHERE user_id IS NOT NULL
  GROUP BY user_id, expert_id, schedule_date, start_time
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'No duplicates found ✓'
    ELSE CONCAT('Found ', COUNT(*), ' duplicate records!')
  END as result
FROM duplicates;

-- 6. 가용 슬롯 샘플 (최근 10개)
SELECT 
  '=== 가용 슬롯 샘플 ===' as title;

SELECT 
  id,
  expert_id,
  schedule_date,
  start_time,
  end_time,
  type,
  status,
  created_at
FROM counselings
WHERE user_id IS NULL 
  AND status = 'available'
ORDER BY schedule_date DESC, start_time DESC
LIMIT 10;

-- 7. 예약된 상담 샘플 (최근 10개)
SELECT 
  '=== 예약된 상담 샘플 ===' as title;

SELECT 
  id,
  user_id,
  expert_id,
  schedule_date,
  start_time,
  end_time,
  status,
  payment_status,
  created_at
FROM counselings
WHERE user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 8. 인덱스 확인
SELECT 
  '=== 인덱스 상태 ===' as title;

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'counselings'
  AND schemaname = 'public'
ORDER BY indexname;

-- 9. 데이터 무결성 체크
SELECT 
  '=== 데이터 무결성 체크 ===' as title;

-- 9.1. NULL 체크
SELECT 
  'Required fields NULL check' as check_type,
  COUNT(*) as invalid_records
FROM counselings
WHERE expert_id IS NULL
   OR status IS NULL
   OR created_at IS NULL;

-- 9.2. 날짜 일관성 체크
SELECT 
  'Date consistency check' as check_type,
  COUNT(*) as invalid_records
FROM counselings
WHERE appointment_date IS NOT NULL 
  AND schedule_date IS NOT NULL
  AND DATE(appointment_date) != schedule_date;

-- 9.3. 시간 범위 체크
SELECT 
  'Time range check' as check_type,
  COUNT(*) as invalid_records
FROM counselings
WHERE start_time IS NOT NULL 
  AND end_time IS NOT NULL
  AND start_time >= end_time;

-- 10. 성능 테스트 쿼리
SELECT 
  '=== 성능 테스트 ===' as title;

-- 10.1. 전문가별 가용 슬롯 조회 (인덱스 사용)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * 
FROM counselings 
WHERE expert_id = 1 
  AND user_id IS NULL 
  AND status = 'available'
  AND schedule_date >= CURRENT_DATE
ORDER BY schedule_date, start_time
LIMIT 20;

-- 10.2. 사용자별 예약 조회 (인덱스 사용)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * 
FROM counselings
WHERE user_id = 1
  AND status IN ('pending', 'approved', 'in_progress')
ORDER BY schedule_date DESC, start_time DESC
LIMIT 20;

-- 11. 권장사항
SELECT 
  '=== 권장사항 ===' as title;

SELECT 
  '1. 모든 검증이 통과하면 백업 테이블은 최소 1개월 보관 후 삭제' as recommendation
UNION ALL
SELECT 
  '2. counselings_unified 테이블은 충분한 모니터링 후 삭제'
UNION ALL
SELECT 
  '3. schedules 테이블은 더 이상 필요없으므로 삭제 가능'
UNION ALL
SELECT 
  '4. 애플리케이션 로그를 모니터링하여 에러 발생 여부 확인'
UNION ALL
SELECT 
  '5. 성능 모니터링을 통해 인덱스 효과성 검증';