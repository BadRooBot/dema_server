-- ═══════════════════════════════════════════════════════════════════════════════
-- Plans Management App Database (PostgreSQL)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- Users Table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    avatar TEXT DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Plans Table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    plan_type VARCHAR(50) DEFAULT 'other' CHECK(plan_type IN ('study', 'training', 'reading', 'other')),
    image_path TEXT DEFAULT NULL,
    color VARCHAR(20) DEFAULT '#4CAF50',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed', 'paused', 'cancelled')),
    daily_goal_minutes INTEGER DEFAULT 0,
    reminders_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Tasks Table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    task_date DATE NOT NULL,
    start_time TIME DEFAULT NULL,
    end_time TIME DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'partially_completed', 'completed', 'skipped')),
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    actual_duration_minutes INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 2 CHECK(priority IN (1, 2, 3)),
    color VARCHAR(20) DEFAULT '#2196F3',
    -- Recurring Logic Fields
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50) DEFAULT NULL, -- 'daily', 'weekly', etc.
    repeat_days VARCHAR(7) DEFAULT '0000000', -- '0111100' for Sun-Thu
    parent_task_id INTEGER DEFAULT NULL REFERENCES tasks(id) ON DELETE SET NULL, -- for generated instances
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(task_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Task Completions Log
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_completions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completion_date DATE NOT NULL,
    duration_completed INTEGER NOT NULL DEFAULT 0,
    session_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Notes Table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER DEFAULT NULL REFERENCES plans(id) ON DELETE SET NULL,
    task_id INTEGER DEFAULT NULL REFERENCES tasks(id) ON DELETE SET NULL,
    title VARCHAR(255),
    content TEXT NOT NULL,
    color VARCHAR(20) DEFAULT '#FFEB3B',
    is_pinned BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Daily Statistics Table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_statistics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    partially_completed_tasks INTEGER DEFAULT 0,
    not_started_tasks INTEGER DEFAULT 0,
    total_planned_minutes INTEGER DEFAULT 0,
    total_completed_minutes INTEGER DEFAULT 0,
    completion_rate NUMERIC(5,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stat_date)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Updated At Function & Trigger
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
