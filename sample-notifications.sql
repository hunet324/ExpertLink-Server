-- 샘플 알림 데이터 추가

-- 샘플 사용자 생성 (테스트용)
INSERT INTO users (name, email, password_hash, user_type, status, created_at) VALUES 
('김테스트', 'test@example.com', '$2b$12$dummyhashedpassword123456', 'general', 'active', NOW() - INTERVAL '30 days'),
('박전문가', 'expert@example.com', '$2b$12$dummyhashedpassword789012', 'expert', 'active', NOW() - INTERVAL '25 days')
ON CONFLICT (email) DO NOTHING;

-- 다양한 유형의 샘플 알림 데이터
INSERT INTO notifications (
    user_id, title, message, type, reference_id, is_read, created_at, metadata
) VALUES 
-- 상담 관련 알림
(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '상담 예약이 승인되었습니다',
    '박전문가님과의 상담이 2024년 1월 20일 오후 2시에 확정되었습니다. 상담 전 준비사항을 확인해보세요.',
    'counseling',
    1,
    false,
    NOW() - INTERVAL '2 hours',
    '{"action_url": "/counselings/1", "icon": "calendar", "priority": "high"}'
),

(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '상담 시작 30분 전입니다',
    '예정된 상담이 30분 후에 시작됩니다. 상담 링크를 확인하고 준비해주세요.',
    'counseling',
    1,
    false,
    NOW() - INTERVAL '30 minutes',
    '{"action_url": "/counselings/1", "icon": "bell", "priority": "urgent"}'
),

-- 일정 관련 알림
(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '새로운 상담 일정이 등록되었습니다',
    '선호하는 전문가의 새로운 상담 일정이 추가되었습니다. 지금 예약해보세요.',
    'schedule',
    5,
    true,
    NOW() - INTERVAL '1 day',
    '{"action_url": "/schedules", "icon": "clock", "expert_name": "이상담"}'
),

-- 콘텐츠 관련 알림
(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '새로운 심리 콘텐츠가 업데이트되었습니다',
    '스트레스 관리에 대한 새로운 가이드가 업로드되었습니다. 확인해보세요.',
    'content',
    1,
    true,
    NOW() - INTERVAL '3 days',
    '{"action_url": "/contents/1", "icon": "article", "category": "stress"}'
),

(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '추천 콘텐츠가 있습니다',
    '당신의 관심사를 바탕으로 맞춤형 심리 콘텐츠를 추천합니다.',
    'content',
    null,
    false,
    NOW() - INTERVAL '6 hours',
    '{"action_url": "/contents?category=depression", "icon": "recommend", "tags": ["우울", "자존감"]}'
),

-- 심리 검사 관련 알림
(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '심리 검사 결과가 나왔습니다',
    '최근 실시한 스트레스 척도 검사의 결과를 확인해보세요.',
    'psych_test',
    1,
    false,
    NOW() - INTERVAL '1 hour',
    '{"action_url": "/users/psych-results", "icon": "assessment", "test_name": "스트레스 척도 검사"}'
),

-- 채팅 관련 알림
(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '새로운 메시지가 도착했습니다',
    '박전문가님으로부터 새로운 메시지가 도착했습니다.',
    'chat',
    1,
    false,
    NOW() - INTERVAL '10 minutes',
    '{"action_url": "/chat/rooms/1", "icon": "message", "sender": "박전문가"}'
),

-- 시스템 알림
(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    'ExpertLink 서비스 이용 안내',
    '더 나은 서비스 제공을 위해 시스템 점검이 예정되어 있습니다. 2024년 1월 25일 오전 2시-4시',
    'system',
    null,
    true,
    NOW() - INTERVAL '5 days',
    '{"icon": "info", "maintenance_date": "2024-01-25T02:00:00"}'
),

(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '월간 활동 리포트',
    '이번 달 ExpertLink 이용 현황을 확인해보세요. 총 3회의 상담과 5개의 콘텐츠를 이용하셨습니다.',
    'system',
    null,
    false,
    NOW() - INTERVAL '12 hours',
    '{"action_url": "/users/activity-report", "icon": "chart", "stats": {"counselings": 3, "contents": 5}}'
),

-- 전문가용 알림 (expert@example.com)
(
    (SELECT id FROM users WHERE email = 'expert@example.com' LIMIT 1),
    '새로운 상담 요청이 있습니다',
    '김테스트님이 상담을 요청했습니다. 요청을 확인하고 승인해주세요.',
    'counseling',
    1,
    false,
    NOW() - INTERVAL '3 hours',
    '{"action_url": "/expert/counseling-requests", "icon": "user", "client_name": "김테스트"}'
),

(
    (SELECT id FROM users WHERE email = 'expert@example.com' LIMIT 1),
    '일정이 예약되었습니다',
    '1월 20일 오후 2시 일정에 새로운 예약이 들어왔습니다.',
    'schedule',
    5,
    true,
    NOW() - INTERVAL '2 days',
    '{"action_url": "/expert/schedule", "icon": "calendar", "date": "2024-01-20T14:00:00"}'
),

-- 읽지 않은 최신 알림들
(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '상담 피드백 요청',
    '완료된 상담에 대한 피드백을 남겨주세요. 다른 이용자들에게 도움이 됩니다.',
    'counseling',
    1,
    false,
    NOW() - INTERVAL '5 minutes',
    '{"action_url": "/counselings/1/feedback", "icon": "feedback", "rating_required": true}'
),

(
    (SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1),
    '이벤트 참여 안내',
    '심리 건강의 달 기념 이벤트가 진행 중입니다. 참여하시면 무료 상담 기회를 드립니다.',
    'system',
    null,
    false,
    NOW() - INTERVAL '1 minute',
    '{"action_url": "/events/mental-health-month", "icon": "event", "event_end": "2024-01-31", "reward": "무료 상담"}'
);

-- 알림 통계를 위한 더 많은 샘플 데이터 (시간대별 분포)
INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES 
-- 이번 주 알림들
((SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1), '주간 리포트', '이번 주 활동 요약입니다.', 'system', true, NOW() - INTERVAL '2 days'),
((SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1), '새 콘텐츠', '명상 관련 새 글이 업로드되었습니다.', 'content', true, NOW() - INTERVAL '4 days'),
((SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1), '일정 알림', '내일 상담이 예정되어 있습니다.', 'schedule', false, NOW() - INTERVAL '6 days'),

-- 지난 달 알림들
((SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1), '월간 요약', '지난 달 이용 현황입니다.', 'system', true, NOW() - INTERVAL '15 days'),
((SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1), '검사 완료', '불안 척도 검사를 완료하셨습니다.', 'psych_test', true, NOW() - INTERVAL '20 days'),
((SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1), '상담 종료', '상담이 성공적으로 완료되었습니다.', 'counseling', true, NOW() - INTERVAL '25 days');