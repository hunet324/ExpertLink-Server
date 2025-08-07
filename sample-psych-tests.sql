-- 샘플 심리 설문 데이터 추가

-- 1. 스트레스 척도 검사 (SCALE 타입)
INSERT INTO psych_tests (
    title, description, logic_type, is_active, max_score, estimated_time, 
    instruction, scoring_rules, result_ranges, created_at
) VALUES (
    '스트레스 척도 검사',
    '일상생활에서 느끼는 스트레스 정도를 측정하는 표준화된 검사입니다.',
    'scale',
    true,
    40,
    10,
    '다음 문항들을 읽고 최근 2주간의 경험을 바탕으로 가장 적절한 답을 선택해주세요.',
    '{"scoring_method": "sum", "reverse_questions": [2, 5, 8]}',
    '{
        "낮음": {"min": 0, "max": 13, "description": "스트레스 수준이 낮습니다. 현재 상태를 잘 유지해보세요."},
        "보통": {"min": 14, "max": 26, "description": "평균적인 스트레스 수준입니다. 적절한 휴식과 관리가 필요합니다."},
        "높음": {"min": 27, "max": 40, "description": "스트레스 수준이 높습니다. 전문가의 도움을 받아 관리방법을 찾아보세요."}
    }',
    NOW()
);

-- 2. 간단한 MBTI 검사 (MBTI 타입)
INSERT INTO psych_tests (
    title, description, logic_type, is_active, estimated_time, 
    instruction, scoring_rules, created_at
) VALUES (
    '간단한 성격 유형 검사 (MBTI)',
    '16가지 성격 유형 중 나에게 가장 적합한 유형을 찾아보는 검사입니다.',
    'mbti',
    true,
    15,
    '각 문항에서 두 선택지 중 자신에게 더 가까운 것을 선택해주세요. 정답은 없으니 솔직하게 답변해주세요.',
    '{"dimensions": ["EI", "SN", "TF", "JP"], "calculation": "majority"}',
    NOW()
);

-- 3. 학습 스타일 검사 (CATEGORY 타입)
INSERT INTO psych_tests (
    title, description, logic_type, is_active, estimated_time, 
    instruction, scoring_rules, created_at
) VALUES (
    '학습 스타일 진단',
    '개인의 학습 선호도와 효과적인 학습 방법을 알아보는 검사입니다.',
    'category',
    true,
    8,
    '다음 상황에서 자신이 선호하는 방법을 선택해주세요.',
    '{"categories": ["시각형", "청각형", "체감각형", "읽기형"], "method": "frequency"}',
    NOW()
);

-- 스트레스 척도 검사 문항들
INSERT INTO psych_questions (test_id, question, question_order, question_type, options, is_required, created_at) VALUES 
-- 1번 설문 문항들
(1, '최근 2주 동안 긴장감이나 스트레스를 얼마나 느꼈습니까?', 1, 'scale', 
'[
    {"value": 0, "text": "전혀 없음", "score": 0},
    {"value": 1, "text": "약간", "score": 1},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "상당히", "score": 3},
    {"value": 4, "text": "매우 심함", "score": 4}
]', true, NOW()),

(1, '최근 2주 동안 여유롭고 편안함을 느낀 적이 있습니까?', 2, 'scale', 
'[
    {"value": 0, "text": "전혀 없음", "score": 4},
    {"value": 1, "text": "약간", "score": 3},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "상당히", "score": 1},
    {"value": 4, "text": "매우 많이", "score": 0}
]', true, NOW()),

(1, '최근 2주 동안 짜증이나 화를 얼마나 느꼈습니까?', 3, 'scale', 
'[
    {"value": 0, "text": "전혀 없음", "score": 0},
    {"value": 1, "text": "약간", "score": 1},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "상당히", "score": 3},
    {"value": 4, "text": "매우 심함", "score": 4}
]', true, NOW()),

(1, '최근 2주 동안 어떤 일에 대처하기 어렵다고 느낀 적이 있습니까?', 4, 'scale', 
'[
    {"value": 0, "text": "전혀 없음", "score": 0},
    {"value": 1, "text": "약간", "score": 1},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "상당히", "score": 3},
    {"value": 4, "text": "매우 심함", "score": 4}
]', true, NOW()),

(1, '최근 2주 동안 자신감을 가지고 개인적인 문제들을 다룰 수 있다고 느꼈습니까?', 5, 'scale', 
'[
    {"value": 0, "text": "전혀 아님", "score": 4},
    {"value": 1, "text": "거의 아님", "score": 3},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "자주", "score": 1},
    {"value": 4, "text": "매우 자주", "score": 0}
]', true, NOW()),

(1, '최근 2주 동안 일이 잘 풀리지 않는다고 느낀 적이 있습니까?', 6, 'scale', 
'[
    {"value": 0, "text": "전혀 없음", "score": 0},
    {"value": 1, "text": "약간", "score": 1},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "상당히", "score": 3},
    {"value": 4, "text": "매우 심함", "score": 4}
]', true, NOW()),

(1, '최근 2주 동안 일상의 짜증거리들을 처리할 수 없다고 느꼈습니까?', 7, 'scale', 
'[
    {"value": 0, "text": "전혀 아님", "score": 0},
    {"value": 1, "text": "거의 아님", "score": 1},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "자주", "score": 3},
    {"value": 4, "text": "매우 자주", "score": 4}
]', true, NOW()),

(1, '최근 2주 동안 생활을 잘 통제하고 있다고 느꼈습니까?', 8, 'scale', 
'[
    {"value": 0, "text": "전혀 아님", "score": 4},
    {"value": 1, "text": "거의 아님", "score": 3},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "자주", "score": 1},
    {"value": 4, "text": "매우 자주", "score": 0}
]', true, NOW()),

(1, '최근 2주 동안 화가 나서 통제할 수 없다고 느낀 적이 있습니까?', 9, 'scale', 
'[
    {"value": 0, "text": "전혀 없음", "score": 0},
    {"value": 1, "text": "약간", "score": 1},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "상당히", "score": 3},
    {"value": 4, "text": "매우 심함", "score": 4}
]', true, NOW()),

(1, '최근 2주 동안 어려움들이 너무 쌓여서 극복할 수 없다고 느꼈습니까?', 10, 'scale', 
'[
    {"value": 0, "text": "전혀 아님", "score": 0},
    {"value": 1, "text": "거의 아님", "score": 1},
    {"value": 2, "text": "보통", "score": 2},
    {"value": 3, "text": "자주", "score": 3},
    {"value": 4, "text": "매우 자주", "score": 4}
]', true, NOW());

-- MBTI 검사 문항들
INSERT INTO psych_questions (test_id, question, question_order, question_type, options, is_required, created_at) VALUES 
(2, '새로운 사람들과 만나는 것에 대해 어떻게 생각하시나요?', 1, 'multiple_choice', 
'[
    {"value": "E", "text": "새로운 사람들과 만나는 것이 즐겁고 에너지를 얻는다"},
    {"value": "I", "text": "새로운 사람들과 만나는 것이 부담스럽고 에너지가 소모된다"}
]', true, NOW()),

(2, '문제를 해결할 때 주로 어떤 방식을 선호하시나요?', 2, 'multiple_choice', 
'[
    {"value": "S", "text": "구체적인 사실과 경험을 바탕으로 단계적으로 접근한다"},
    {"value": "N", "text": "직감적으로 전체적인 그림을 보고 창의적인 방법을 찾는다"}
]', true, NOW()),

(2, '결정을 내릴 때 무엇을 더 중시하시나요?', 3, 'multiple_choice', 
'[
    {"value": "T", "text": "논리적이고 객관적인 분석을 통한 합리적 판단"},
    {"value": "F", "text": "개인적 가치와 타인의 감정을 고려한 인간적 판단"}
]', true, NOW()),

(2, '일을 계획하고 진행할 때 어떤 방식을 선호하시나요?', 4, 'multiple_choice', 
'[
    {"value": "J", "text": "미리 계획을 세우고 체계적으로 일정에 맞춰 진행한다"},
    {"value": "P", "text": "융통성을 가지고 상황에 따라 유연하게 조정한다"}
]', true, NOW()),

(2, '휴일을 보낼 때 어떤 것을 더 선호하시나요?', 5, 'multiple_choice', 
'[
    {"value": "E", "text": "친구들과 함께 활동적인 시간을 보낸다"},
    {"value": "I", "text": "혼자서 조용히 휴식을 취하거나 취미생활을 한다"}
]', true, NOW()),

(2, '학습이나 업무에서 어떤 정보를 더 신뢰하시나요?', 6, 'multiple_choice', 
'[
    {"value": "S", "text": "검증된 데이터와 구체적인 사례들"},
    {"value": "N", "text": "직감적인 통찰과 미래 가능성들"}
]', true, NOW()),

(2, '갈등 상황에서 어떤 접근을 하시나요?', 7, 'multiple_choice', 
'[
    {"value": "T", "text": "객관적 사실에 근거해 논리적으로 해결하려 한다"},
    {"value": "F", "text": "관련된 사람들의 마음과 관계를 고려해 해결하려 한다"}
]', true, NOW()),

(2, '여행을 갈 때 어떤 스타일을 선호하시나요?', 8, 'multiple_choice', 
'[
    {"value": "J", "text": "미리 일정과 숙소를 자세히 계획하고 예약한다"},
    {"value": "P", "text": "대략적인 계획만 세우고 현지에서 즉흥적으로 결정한다"}
]', true, NOW());

-- 학습 스타일 검사 문항들
INSERT INTO psych_questions (test_id, question, question_order, question_type, options, is_required, created_at) VALUES 
(3, '새로운 내용을 배울 때 어떤 방법이 가장 효과적이라고 생각하시나요?', 1, 'multiple_choice', 
'[
    {"value": "시각형", "text": "그림, 도표, 색깔로 정리된 자료를 보며 학습"},
    {"value": "청각형", "text": "설명을 듣거나 토론하며 학습"},
    {"value": "체감각형", "text": "직접 체험하거나 실습을 통해 학습"},
    {"value": "읽기형", "text": "글로 된 자료를 읽고 요약하며 학습"}
]', true, NOW()),

(3, '정보를 기억할 때 어떤 것이 가장 도움이 되나요?', 2, 'multiple_choice', 
'[
    {"value": "시각형", "text": "머릿속으로 그림이나 장면을 그려가며 기억"},
    {"value": "청각형", "text": "소리내어 읽거나 리듬감 있게 암송"},
    {"value": "체감각형", "text": "손으로 써가며 몸의 움직임과 함께 기억"},
    {"value": "읽기형", "text": "키워드를 정리하고 문장으로 연결해서 기억"}
]', true, NOW()),

(3, '문제를 해결할 때 주로 어떤 방식을 사용하나요?', 3, 'multiple_choice', 
'[
    {"value": "시각형", "text": "다이어그램이나 순서도를 그려가며 해결"},
    {"value": "청각형", "text": "다른 사람과 이야기하며 아이디어를 교환"},
    {"value": "체감각형", "text": "여러 방법을 직접 시도해보며 해결"},
    {"value": "읽기형", "text": "관련 자료를 찾아 읽고 분석해서 해결"}
]', true, NOW()),

(3, '집중이 가장 잘 되는 환경은 어떤 곳인가요?', 4, 'multiple_choice', 
'[
    {"value": "시각형", "text": "깔끔하고 시각적으로 정리된 공간"},
    {"value": "청각형", "text": "적당한 배경음악이 있는 공간"},
    {"value": "체감각형", "text": "자유롭게 움직이며 활동할 수 있는 공간"},
    {"value": "읽기형", "text": "조용하고 방해받지 않는 독서실 같은 공간"}
]', true, NOW()),

(3, '설명을 들을 때 어떤 방식의 설명이 가장 이해하기 쉬운가요?', 5, 'multiple_choice', 
'[
    {"value": "시각형", "text": "그래프, 차트, 이미지가 포함된 시각적 설명"},
    {"value": "청각형", "text": "말로 자세히 설명해주는 구두 설명"},
    {"value": "체감각형", "text": "직접 해보며 단계별로 알려주는 실습 설명"},
    {"value": "읽기형", "text": "체계적으로 글로 정리된 텍스트 설명"}
]', true, NOW());

-- 인덱스 추가
CREATE INDEX idx_psych_tests_active ON psych_tests(is_active);
CREATE INDEX idx_psych_questions_test ON psych_questions(test_id, question_order);
CREATE INDEX idx_psych_answers_user_question ON psych_answers(user_id, question_id);
CREATE INDEX idx_psych_results_user_test ON psych_results(user_id, test_id);
CREATE INDEX idx_psych_results_completed ON psych_results(completed_at DESC);