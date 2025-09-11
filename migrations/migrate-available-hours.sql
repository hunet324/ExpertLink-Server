-- available_hours 데이터를 schedules 테이블로 마이그레이션
-- 
-- 이 스크립트는 expert_profiles 테이블의 available_hours JSONB 데이터를
-- schedules 테이블의 개별 레코드로 변환합니다.

DO $$
DECLARE
    expert_record RECORD;
    day_key TEXT;
    time_slot JSONB;
    target_date DATE;
    week_offset INTEGER;
    day_index INTEGER;
    day_mapping JSONB := '{
        "sunday": 0,
        "monday": 1, 
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
        "friday": 5,
        "saturday": 6
    }'::JSONB;
BEGIN
    -- 기존 schedules 테이블 데이터 삭제 (마이그레이션 재실행 시)
    DELETE FROM schedules WHERE created_at < NOW();
    
    -- 각 전문가의 available_hours 처리
    FOR expert_record IN 
        SELECT id, user_id, available_hours 
        FROM expert_profiles 
        WHERE available_hours IS NOT NULL 
        AND available_hours != '{}'::JSONB
    LOOP
        RAISE NOTICE '전문가 ID %의 available_hours 마이그레이션 시작', expert_record.user_id;
        
        -- 향후 4주간의 일정 생성
        FOR week_offset IN 0..3 LOOP
            -- 각 요일별 처리
            FOR day_key IN SELECT jsonb_object_keys(expert_record.available_hours) LOOP
                -- 요일 인덱스 가져오기
                day_index := (day_mapping->day_key)::INTEGER;
                
                IF day_index IS NOT NULL THEN
                    -- 해당 주의 해당 요일 날짜 계산
                    target_date := CURRENT_DATE + (week_offset * 7 + day_index - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) * INTERVAL '1 day';
                    
                    -- 해당 요일의 시간 슬롯들 처리
                    FOR time_slot IN 
                        SELECT jsonb_array_elements(expert_record.available_hours->day_key)
                    LOOP
                        -- 시간 슬롯 데이터가 유효한 경우에만 삽입
                        IF time_slot ? 'start' AND time_slot ? 'end' THEN
                            INSERT INTO schedules (
                                expert_id,
                                schedule_date,
                                start_time,
                                end_time,
                                status,
                                created_at,
                                updated_at
                            ) VALUES (
                                expert_record.user_id,
                                target_date,
                                (time_slot->>'start')::TIME,
                                (time_slot->>'end')::TIME,
                                'available',
                                NOW(),
                                NOW()
                            )
                            ON CONFLICT (expert_id, schedule_date, start_time) 
                            DO NOTHING;  -- 중복 방지
                        END IF;
                    END LOOP;
                END IF;
            END LOOP;
        END LOOP;
        
        RAISE NOTICE '전문가 ID %의 마이그레이션 완료', expert_record.user_id;
    END LOOP;
    
    RAISE NOTICE '전체 available_hours → schedules 마이그레이션 완료';
END $$;