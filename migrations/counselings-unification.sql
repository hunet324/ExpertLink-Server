-- =====================================================
-- Counselings 테이블 통합 마이그레이션 스크립트
-- 작성일: 2025-09-10
-- 목적: counselings_unified 기능을 counselings 테이블로 통합
-- =====================================================

-- 트랜잭션 시작
BEGIN;

-- =====================================================
-- 1단계: 기존 테이블 백업
-- =====================================================
CREATE TABLE IF NOT EXISTS counselings_backup AS SELECT * FROM counselings;
CREATE TABLE IF NOT EXISTS schedules_backup AS SELECT * FROM schedules;
CREATE TABLE IF NOT EXISTS counselings_unified_backup AS SELECT * FROM counselings_unified;

-- 백업 테이블에 타임스탬프 추가
ALTER TABLE counselings_backup ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE schedules_backup ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE counselings_unified_backup ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- 2단계: counselings 테이블 스키마 변경
-- =====================================================

-- 새로운 컬럼 추가
ALTER TABLE counselings 
ADD COLUMN IF NOT EXISTS schedule_date DATE,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS title VARCHAR(200),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMP;

-- status enum 확장 (이미 존재하는 경우 무시)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'available' AND enumtypid = 'counselings_status'::regtype::oid) THEN
        ALTER TYPE counselings_status ADD VALUE 'available';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = 'counselings_status'::regtype::oid) THEN
        ALTER TYPE counselings_status ADD VALUE 'in_progress';
    END IF;
END $$;

-- user_id를 nullable로 변경 (가용 슬롯 지원)
ALTER TABLE counselings ALTER COLUMN user_id DROP NOT NULL;

-- reason 컬럼도 nullable로 변경 (가용 슬롯은 reason이 없음)
ALTER TABLE counselings ALTER COLUMN reason DROP NOT NULL;

-- =====================================================
-- 3단계: 데이터 마이그레이션
-- =====================================================

-- 3.1. 기존 counselings 데이터에 schedule 정보 병합
UPDATE counselings c
SET 
  schedule_date = s.date,
  start_time = s.start_time,
  end_time = s.end_time,
  duration = COALESCE(s.duration, 60)
FROM schedules s
WHERE c.schedule_id = s.id
  AND c.schedule_date IS NULL; -- 이미 업데이트된 경우 제외

-- 3.2. counselings_unified의 가용 슬롯 데이터 이관
INSERT INTO counselings (
  expert_id, schedule_date, start_time, end_time, duration,
  type, status, created_at, updated_at, user_id, payment_status
)
SELECT 
  expert_id, 
  schedule_date, 
  start_time, 
  end_time, 
  duration,
  type::text::counselings_type, 
  'available'::counselings_status, 
  created_at, 
  updated_at, 
  NULL,
  'pending'::counselings_payment_status
FROM counselings_unified
WHERE user_id IS NULL AND status = 'available'
  AND NOT EXISTS (
    -- 중복 방지
    SELECT 1 FROM counselings c 
    WHERE c.expert_id = counselings_unified.expert_id
      AND c.schedule_date = counselings_unified.schedule_date
      AND c.start_time = counselings_unified.start_time
  );

-- 3.3. counselings_unified의 예약된 상담 데이터 병합
INSERT INTO counselings (
  user_id, expert_id, schedule_date, start_time, end_time, duration,
  type, status, reason, session_notes, user_feedback, rating,
  payment_amount, payment_status, actual_start_time, actual_end_time,
  appointment_date, title, notes, created_at, updated_at
)
SELECT 
  cu.user_id, 
  cu.expert_id, 
  cu.schedule_date, 
  cu.start_time, 
  cu.end_time, 
  cu.duration,
  cu.type::text::counselings_type, 
  CASE 
    WHEN cu.status = 'available' THEN 'available'::counselings_status
    WHEN cu.status = 'pending' THEN 'pending'::counselings_status
    WHEN cu.status = 'approved' THEN 'approved'::counselings_status
    WHEN cu.status = 'in_progress' THEN 'in_progress'::counselings_status
    WHEN cu.status = 'completed' THEN 'completed'::counselings_status
    WHEN cu.status = 'cancelled' THEN 'cancelled'::counselings_status
    WHEN cu.status = 'rejected' THEN 'rejected'::counselings_status
  END,
  cu.reason, 
  cu.session_notes, 
  cu.user_feedback, 
  cu.rating,
  cu.payment_amount, 
  cu.payment_status::text::counselings_payment_status, 
  cu.actual_start_time, 
  cu.actual_end_time,
  COALESCE(cu.actual_start_time, (cu.schedule_date + cu.start_time)::timestamp) as appointment_date,
  cu.title,
  cu.notes,
  cu.created_at, 
  cu.updated_at
FROM counselings_unified cu
WHERE cu.user_id IS NOT NULL
  AND NOT EXISTS (
    -- 중복 방지
    SELECT 1 FROM counselings c 
    WHERE c.user_id = cu.user_id 
      AND c.expert_id = cu.expert_id
      AND c.schedule_date = cu.schedule_date
      AND c.start_time = cu.start_time
  );

-- =====================================================
-- 4단계: 인덱스 최적화
-- =====================================================

-- 가용 슬롯 검색 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_counselings_available_slots 
ON counselings(expert_id, schedule_date, start_time) 
WHERE user_id IS NULL AND status = 'available';

-- 예약된 상담 검색 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_counselings_booked_sessions
ON counselings(user_id, expert_id, schedule_date)
WHERE user_id IS NOT NULL;

-- 날짜별 일정 검색 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_counselings_schedule_date
ON counselings(schedule_date, start_time);

-- 전문가별 일정 검색 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_counselings_expert_schedule
ON counselings(expert_id, schedule_date, start_time);

-- =====================================================
-- 5단계: 외래키 제약 조건 정리
-- =====================================================

-- schedule_id 컬럼이 더 이상 필요없으므로 제거
ALTER TABLE counselings DROP CONSTRAINT IF EXISTS counselings_schedule_id_fkey;
ALTER TABLE counselings DROP COLUMN IF EXISTS schedule_id;

-- =====================================================
-- 6단계: 데이터 무결성 검증
-- =====================================================

-- 마이그레이션 결과 통계
DO $$
DECLARE
  original_count INTEGER;
  unified_count INTEGER;
  migrated_count INTEGER;
  available_slots_count INTEGER;
  booked_sessions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM counselings_backup;
  SELECT COUNT(*) INTO unified_count FROM counselings_unified_backup;
  SELECT COUNT(*) INTO migrated_count FROM counselings;
  SELECT COUNT(*) INTO available_slots_count FROM counselings WHERE user_id IS NULL;
  SELECT COUNT(*) INTO booked_sessions_count FROM counselings WHERE user_id IS NOT NULL;
  
  RAISE NOTICE '=== 마이그레이션 결과 ===';
  RAISE NOTICE 'Original counselings: %', original_count;
  RAISE NOTICE 'Counselings unified: %', unified_count;
  RAISE NOTICE 'Total migrated: %', migrated_count;
  RAISE NOTICE 'Available slots: %', available_slots_count;
  RAISE NOTICE 'Booked sessions: %', booked_sessions_count;
END $$;

-- =====================================================
-- 7단계: 이전 테이블 제거 (주의: 충분한 검증 후 실행)
-- =====================================================

-- 아래 명령어는 모든 검증이 완료된 후 별도로 실행하세요
-- DROP TABLE IF EXISTS counselings_unified;
-- DROP TABLE IF EXISTS schedules;

COMMIT;

-- =====================================================
-- 검증 쿼리들
-- =====================================================

-- 가용 슬롯 확인
-- SELECT expert_id, schedule_date, start_time, end_time, type, status
-- FROM counselings 
-- WHERE user_id IS NULL AND status = 'available'
-- ORDER BY expert_id, schedule_date, start_time
-- LIMIT 10;

-- 예약된 상담 확인
-- SELECT user_id, expert_id, schedule_date, start_time, status, payment_status
-- FROM counselings 
-- WHERE user_id IS NOT NULL
-- ORDER BY schedule_date DESC, start_time DESC
-- LIMIT 10;

-- 데이터 무결성 체크
-- SELECT 
--   'Original counselings' as source, COUNT(*) as count 
-- FROM counselings_backup
-- UNION ALL
-- SELECT 
--   'Unified counselings' as source, COUNT(*) as count 
-- FROM counselings_unified_backup
-- UNION ALL
-- SELECT 
--   'Migrated total' as source, COUNT(*) as count 
-- FROM counselings
-- UNION ALL
-- SELECT 
--   'Available slots' as source, COUNT(*) as count 
-- FROM counselings
-- WHERE user_id IS NULL AND status = 'available'
-- UNION ALL
-- SELECT 
--   'Booked sessions' as source, COUNT(*) as count 
-- FROM counselings
-- WHERE user_id IS NOT NULL;