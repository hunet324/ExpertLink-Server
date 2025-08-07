-- ExpertLink Database Schema
-- PostgreSQL 15+

-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    user_type user_type_enum NOT NULL DEFAULT 'general',
    signup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status user_status_enum NOT NULL DEFAULT 'pending',
    profile_image VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ENUM 타입 정의
CREATE TYPE user_type_enum AS ENUM ('general', 'expert', 'admin');
CREATE TYPE user_status_enum AS ENUM ('pending', 'active', 'inactive', 'withdrawn');
CREATE TYPE schedule_status_enum AS ENUM ('available', 'booked', 'completed', 'cancelled');
CREATE TYPE counseling_status_enum AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled');
CREATE TYPE content_type_enum AS ENUM ('article', 'video', 'audio', 'infographic', 'quiz', 'meditation', 'exercise');
CREATE TYPE content_status_enum AS ENUM ('draft', 'published', 'archived');
CREATE TYPE content_category_enum AS ENUM ('depression', 'anxiety', 'stress', 'relationship', 'self_esteem', 'sleep', 'addiction', 'trauma', 'parenting', 'workplace', 'general');

-- 심리 설문 테이블
CREATE TABLE psych_tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    logic_type VARCHAR(50) NOT NULL, -- 'mbti', 'scale', 'category'
    is_active BOOLEAN DEFAULT true,
    max_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 설문 문항 테이블
CREATE TABLE psych_questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES psych_tests(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_order INTEGER NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice', -- 'multiple_choice', 'scale', 'text'
    options JSONB, -- 선택지 저장 (JSON 형태)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 설문 응답 테이블
CREATE TABLE psych_answers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES psych_questions(id) ON DELETE CASCADE,
    answer_value VARCHAR(500) NOT NULL,
    score INTEGER, -- 점수화 가능한 응답
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, question_id) -- 한 사용자는 같은 문항에 하나의 답변만
);

-- 전문가 프로필 테이블 (users 테이블 확장)
CREATE TABLE expert_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    specialization VARCHAR(100)[], -- 전문 분야 (배열)
    license_number VARCHAR(50),
    license_type VARCHAR(50),
    years_experience INTEGER,
    hourly_rate DECIMAL(10,2),
    introduction TEXT,
    education TEXT,
    career_history TEXT,
    is_verified BOOLEAN DEFAULT false,
    verification_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 일정 관리 테이블
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    expert_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status schedule_status_enum DEFAULT 'available',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 같은 전문가의 동일 시간대 중복 방지
    CONSTRAINT unique_expert_schedule UNIQUE(expert_id, schedule_date, start_time)
);

-- 상담 요청/관리 테이블
CREATE TABLE counselings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expert_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    appointment_date TIMESTAMP,
    status counseling_status_enum DEFAULT 'pending',
    reason TEXT NOT NULL,
    session_notes TEXT, -- 상담 후 전문가가 작성
    user_feedback TEXT, -- 상담 후 사용자 피드백
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    payment_amount DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 심리 콘텐츠 테이블
CREATE TABLE contents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type content_type_enum NOT NULL DEFAULT 'article',
    category content_category_enum NOT NULL DEFAULT 'general',
    status content_status_enum NOT NULL DEFAULT 'draft',
    thumbnail_url VARCHAR(500),
    media_url VARCHAR(500), -- 비디오, 오디오, 이미지 URL
    tags JSONB, -- 태그 배열
    reading_time INTEGER DEFAULT 0, -- 예상 읽기 시간 (분)
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(255),
    metadata JSONB, -- 추가 메타데이터
    is_featured BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 콘텐츠 좋아요 테이블
CREATE TABLE content_likes (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES contents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(content_id, user_id)
);

-- 콘텐츠 북마크 테이블
CREATE TABLE content_bookmarks (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES contents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(content_id, user_id)
);

-- 알림 테이블
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    message TEXT NOT NULL,
    type VARCHAR(50), -- 'counseling', 'schedule', 'content', 'system'
    reference_id INTEGER, -- 관련된 테이블의 ID (counseling_id, content_id 등)
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 로그인 이력 테이블
CREATE TABLE login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    is_successful BOOLEAN DEFAULT true
);

-- 채팅방 테이블 (PostgreSQL로 채팅 구현)
CREATE TABLE chat_rooms (
    id SERIAL PRIMARY KEY,
    counseling_id INTEGER REFERENCES counselings(id) ON DELETE CASCADE,
    participants INTEGER[] NOT NULL, -- 참여자 user_id 배열
    room_name VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 채팅 메시지 테이블
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file', 'system'
    content TEXT NOT NULL,
    file_url VARCHAR(500), -- 파일 첨부시
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type_status ON users(user_type, status);
CREATE INDEX idx_psych_answers_user ON psych_answers(user_id);
CREATE INDEX idx_schedules_expert_date ON schedules(expert_id, schedule_date);
CREATE INDEX idx_counselings_user ON counselings(user_id);
CREATE INDEX idx_counselings_expert ON counselings(expert_id);
CREATE INDEX idx_counselings_status ON counselings(status);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_login_history_user ON login_history(user_id);
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at);
CREATE INDEX idx_contents_type_published ON contents(type, is_published);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_profiles_updated_at BEFORE UPDATE ON expert_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counselings_updated_at BEFORE UPDATE ON counselings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();