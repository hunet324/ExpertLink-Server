-- Add schedule_type and duration columns to schedules table
-- Migration for new schedule features

-- Create enum type for schedule_type if not exists
DO $$ BEGIN
    CREATE TYPE schedule_type_enum AS ENUM ('video', 'chat', 'voice');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to schedules table
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS schedule_type schedule_type_enum DEFAULT 'video',
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 50;

-- Update existing schedules to calculate duration based on start_time and end_time
UPDATE schedules 
SET duration = CASE 
    WHEN end_time IS NOT NULL AND start_time IS NOT NULL THEN
        EXTRACT(HOUR FROM end_time::time) * 60 + EXTRACT(MINUTE FROM end_time::time) -
        (EXTRACT(HOUR FROM start_time::time) * 60 + EXTRACT(MINUTE FROM start_time::time))
    ELSE 50
END
WHERE duration IS NULL OR duration = 0;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_schedules_type_date ON schedules(schedule_type, schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_expert_type ON schedules(expert_id, schedule_type);

-- Update constraints
COMMENT ON COLUMN schedules.schedule_type IS '상담 유형: video(화상), chat(채팅), voice(음성)';
COMMENT ON COLUMN schedules.duration IS '상담 시간(분): 10~180분 범위';