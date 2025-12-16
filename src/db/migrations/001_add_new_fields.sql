-- Migration: Add new fields to plans and tasks tables
-- Date: 2025-12-15

-- Add new columns to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS background_image_path TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';

-- Add constraint for priority (if not exists - PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_priority_check'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_priority_check CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS partial_minutes INTEGER DEFAULT 0;

-- Update existing rows to have default values
UPDATE plans SET priority = 'medium' WHERE priority IS NULL;
UPDATE tasks SET actual_minutes = 0 WHERE actual_minutes IS NULL;
UPDATE tasks SET partial_minutes = 0 WHERE partial_minutes IS NULL;
