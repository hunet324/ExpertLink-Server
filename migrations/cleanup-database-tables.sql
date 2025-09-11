-- =====================================================
-- 데이터베이스 정리 스크립트
-- 작성일: 2025-09-10
-- 목적: 마이그레이션 완료 후 불필요한 테이블 제거
-- =====================================================

-- 트랜잭션 시작
BEGIN;

-- =====================================================
-- 1. 삭제 전 최종 확인
-- =====================================================

-- 백업 테이블 확인
SELECT 
  '=== 백업 테이블 확인 ===' as title;

SELECT 
  tablename as table_name,
  schemaname as schema_name
FROM pg_tables 
WHERE tablename LIKE '%_backup'
ORDER BY tablename;

-- 마이그레이션 완료 확인
SELECT 
  '=== 마이그레이션 상태 확인 ===' as title;

SELECT 
  'counselings 테이블 레코드 수' as description,
  COUNT(*) as count
FROM counselings
UNION ALL
SELECT 
  'counselings_unified 테이블 레코드 수',
  COUNT(*)
FROM counselings_unified
UNION ALL
SELECT 
  'schedules 테이블 레코드 수',
  COUNT(*)
FROM schedules;

-- =====================================================
-- 2. 외래키 제약 조건 확인 및 제거
-- =====================================================

-- counselings_unified 테이블 참조하는 외래키 찾기
SELECT 
  '=== counselings_unified 참조 외래키 ===' as title;

SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'counselings_unified';

-- schedules 테이블 참조하는 외래키 찾기
SELECT 
  '=== schedules 참조 외래키 ===' as title;

SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'schedules';

-- =====================================================
-- 3. 의존성 테이블 정리
-- =====================================================

-- counselings 테이블에서 schedule_id 컬럼이 아직 존재하는 경우 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'counselings' 
    AND column_name = 'schedule_id'
  ) THEN
    -- 외래키 제약 조건 제거
    ALTER TABLE counselings DROP CONSTRAINT IF EXISTS counselings_schedule_id_fkey;
    
    -- 컬럼 제거
    ALTER TABLE counselings DROP COLUMN IF EXISTS schedule_id;
    
    RAISE NOTICE 'schedule_id 컬럼이 counselings 테이블에서 제거되었습니다.';
  ELSE
    RAISE NOTICE 'schedule_id 컬럼이 이미 존재하지 않습니다.';
  END IF;
END $$;

-- =====================================================
-- 4. 불필요한 테이블 제거
-- =====================================================

-- 주의: 아래 명령어는 충분한 검증 후에만 실행하세요!
-- 프로덕션 환경에서는 반드시 백업을 확인한 후 실행하세요.

-- counselings_unified 테이블 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'counselings_unified'
  ) THEN
    DROP TABLE counselings_unified CASCADE;
    RAISE NOTICE 'counselings_unified 테이블이 제거되었습니다.';
  ELSE
    RAISE NOTICE 'counselings_unified 테이블이 이미 존재하지 않습니다.';
  END IF;
END $$;

-- schedules 테이블 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'schedules'
  ) THEN
    DROP TABLE schedules CASCADE;
    RAISE NOTICE 'schedules 테이블이 제거되었습니다.';
  ELSE
    RAISE NOTICE 'schedules 테이블이 이미 존재하지 않습니다.';
  END IF;
END $$;

-- =====================================================
-- 5. 관련 인덱스 정리
-- =====================================================

-- 더 이상 필요 없는 인덱스 제거
DROP INDEX IF EXISTS idx_schedules_expert;
DROP INDEX IF EXISTS idx_schedules_date;
DROP INDEX IF EXISTS idx_schedules_status;
DROP INDEX IF EXISTS idx_counselings_schedule;

-- =====================================================
-- 6. 정리 완료 확인
-- =====================================================

-- 테이블 목록 확인
SELECT 
  '=== 정리 후 테이블 목록 ===' as title;

SELECT 
  tablename as table_name,
  schemaname as schema_name
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('counselings', 'counselings_unified', 'schedules')
ORDER BY tablename;

-- counselings 테이블 구조 확인
SELECT 
  '=== counselings 테이블 컬럼 확인 ===' as title;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'counselings'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- counselings 테이블 인덱스 확인
SELECT 
  '=== counselings 테이블 인덱스 확인 ===' as title;

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'counselings'
  AND schemaname = 'public'
ORDER BY indexname;

-- =====================================================
-- 7. 백업 테이블 정리 안내
-- =====================================================

SELECT 
  '=== 백업 테이블 정리 안내 ===' as title;

SELECT 
  '1. 다음 백업 테이블들은 최소 1개월간 보관하세요:' as instruction
UNION ALL
SELECT 
  '   - counselings_backup'
UNION ALL
SELECT 
  '   - counselings_unified_backup'
UNION ALL
SELECT 
  '   - schedules_backup'
UNION ALL
SELECT 
  ''
UNION ALL
SELECT 
  '2. 시스템이 안정적으로 동작하는 것이 확인되면:'
UNION ALL
SELECT 
  '   DROP TABLE counselings_backup;'
UNION ALL
SELECT 
  '   DROP TABLE counselings_unified_backup;'
UNION ALL
SELECT 
  '   DROP TABLE schedules_backup;'
UNION ALL
SELECT 
  ''
UNION ALL
SELECT 
  '3. 모니터링 포인트:'
UNION ALL
SELECT 
  '   - API 응답 정상 동작'
UNION ALL
SELECT 
  '   - 상담 예약/취소 정상 동작'
UNION ALL
SELECT 
  '   - 전문가 일정 관리 정상 동작'
UNION ALL
SELECT 
  '   - 성능 이슈 없음';

COMMIT;

-- =====================================================
-- 정리 완료!
-- =====================================================

SELECT 
  '🎉 데이터베이스 정리가 완료되었습니다!' as message;