-- ExpertLink 성능 최적화를 위한 인덱스 추가
-- 실행 순서: 기존 데이터베이스에 차례대로 실행

-- 1. users 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_user_type_status ON users(user_type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_center_id ON users(center_id) WHERE center_id IS NOT NULL;

-- 2. expert_profiles 테이블 인덱스  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expert_profiles_is_verified ON expert_profiles(is_verified);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expert_profiles_specialization ON expert_profiles USING GIN(specialization);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expert_profiles_hourly_rate ON expert_profiles(hourly_rate) WHERE hourly_rate IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expert_profiles_center_id ON expert_profiles(center_id) WHERE center_id IS NOT NULL;

-- 3. counselings 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_counselings_user_status ON counselings(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_counselings_expert_status ON counselings(expert_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_counselings_appointment_date ON counselings(appointment_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_counselings_created_at ON counselings(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_counselings_updated_at ON counselings(updated_at);

-- 4. contents 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_category_status ON contents(category, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_published_at ON contents(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_view_count_desc ON contents(view_count DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_like_count_desc ON contents(like_count DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_is_featured ON contents(is_featured) WHERE is_featured = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_is_premium ON contents(is_premium);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_author_id ON contents(author_id) WHERE author_id IS NOT NULL;

-- 5. content_likes 테이블 인덱스 (N+1 쿼리 최적화)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_likes_user_id ON content_likes(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_likes_content_user ON content_likes(content_id, user_id);

-- 6. content_bookmarks 테이블 인덱스 (N+1 쿼리 최적화)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_bookmarks_user_id ON content_bookmarks(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_bookmarks_content_user ON content_bookmarks(content_id, user_id);

-- 7. schedules 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_expert_date_status ON schedules(expert_id, schedule_date, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_date_status ON schedules(schedule_date, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);

-- 8. notifications 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_reference_id ON notifications(reference_id) WHERE reference_id IS NOT NULL;

-- 9. chat_messages 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- 10. chat_rooms 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_rooms_participants ON chat_rooms USING GIN(participants);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_rooms_updated_at ON chat_rooms(updated_at DESC);

-- 11. psych_tests 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_tests_is_active ON psych_tests(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_tests_logic_type ON psych_tests(logic_type);

-- 12. psych_questions 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_questions_test_order ON psych_questions(test_id, question_order);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_questions_type ON psych_questions(question_type);

-- 13. psych_answers 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_answers_user_question ON psych_answers(user_id, question_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_answers_question_id ON psych_answers(question_id);

-- 14. psych_results 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_results_user_test ON psych_results(user_id, test_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_results_completed_at ON psych_results(completed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psych_results_result_type ON psych_results(result_type);

-- 15. payments 테이블 인덱스 (결제 관련)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_expert_id ON payments(expert_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

-- 16. system_logs 테이블 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_timestamp_level ON system_logs(timestamp DESC, level);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_action ON system_logs(action);

-- 17. centers 테이블 인덱스 (센터 관리)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_centers_name ON centers(name);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_centers_region ON centers(region) WHERE region IS NOT NULL;
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_centers_is_active ON centers(is_active);

-- 인덱스 생성 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ ExpertLink 성능 최적화 인덱스 생성이 완료되었습니다.';
    RAISE NOTICE '📊 인덱스 사용량은 다음 쿼리로 확인할 수 있습니다:';
    RAISE NOTICE 'SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes ORDER BY idx_tup_read DESC;';
END $$;