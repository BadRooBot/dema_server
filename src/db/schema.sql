-- ═══════════════════════════════════════════════════════════════════════════════
-- Plans Management App Database (PostgreSQL / Neon)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    phone TEXT DEFAULT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT NULL,
    plan_type TEXT DEFAULT 'other' CHECK(plan_type IN ('study', 'training', 'reading', 'other')),
    image_path TEXT DEFAULT NULL,
    color TEXT DEFAULT '#4CAF50',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed', 'paused', 'cancelled')),
    daily_goal_minutes INTEGER DEFAULT 0,
    reminders_enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 2 CHECK(priority IN (1, 2, 3)),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_dates ON plans(start_date, end_date);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    -- For single tasks: specific date. For recurring: NULL (uses plan dates)
    task_date DATE DEFAULT NULL,
    start_time TIME DEFAULT NULL,
    end_time TIME DEFAULT NULL,
    status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'partially_completed', 'completed', 'skipped')),
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    actual_duration_minutes INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 2 CHECK(priority IN (1, 2, 3)),
    color TEXT DEFAULT '#2196F3',
    -- Recurring task fields
    is_recurring INTEGER DEFAULT 0,
    recurrence_pattern TEXT DEFAULT NULL CHECK(recurrence_pattern IN ('daily', 'weekly', 'custom', NULL)),
    -- '1111100' = Sun-Thu, '0000011' = Fri-Sat, etc. Index: 0=Sun, 1=Mon...6=Sat
    repeat_days TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP DEFAULT NULL,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time);

-- Track completion for each day of a recurring task
CREATE TABLE IF NOT EXISTS daily_task_instances (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    instance_date DATE NOT NULL,
    status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'partially_completed', 'completed', 'skipped')),
    actual_duration_minutes INTEGER DEFAULT 0,
    completed_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE(task_id, instance_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_instances_task ON daily_task_instances(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_instances_date ON daily_task_instances(instance_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Habits (Daily Check-ins)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS habits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT NULL,
    icon TEXT DEFAULT '✓',
    color TEXT DEFAULT '#4CAF50',
    target_days TEXT DEFAULT '1111111',  -- Which days to track (0=Sun...6=Sat)
    reminder_time TIME DEFAULT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);

CREATE TABLE IF NOT EXISTS habit_check_ins (
    id SERIAL PRIMARY KEY,
    habit_id INTEGER NOT NULL,
    check_date DATE NOT NULL,
    is_completed INTEGER DEFAULT 1,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE(habit_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_checkins_habit ON habit_check_ins(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_checkins_date ON habit_check_ins(check_date);

CREATE TABLE IF NOT EXISTS task_completions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    completion_date DATE NOT NULL,
    duration_completed INTEGER NOT NULL DEFAULT 0,
    session_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_date ON task_completions(completion_date);

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_id INTEGER DEFAULT NULL,
    task_id INTEGER DEFAULT NULL,
    title TEXT DEFAULT NULL,
    content TEXT NOT NULL,
    color TEXT DEFAULT '#FFEB3B',
    is_pinned INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_plan_id ON notes(plan_id);
CREATE INDEX IF NOT EXISTS idx_notes_task_id ON notes(task_id);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    task_id INTEGER DEFAULT NULL,
    plan_id INTEGER DEFAULT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT NULL,
    notification_time TIMESTAMP NOT NULL,
    notification_type TEXT DEFAULT 'task_reminder' CHECK(notification_type IN ('task_reminder', 'plan_reminder', 'daily_summary', 'custom')),
    is_enabled INTEGER DEFAULT 1,
    is_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_time ON notifications(notification_time);
CREATE INDEX IF NOT EXISTS idx_notifications_enabled ON notifications(is_enabled);

CREATE TABLE IF NOT EXISTS daily_statistics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    partially_completed_tasks INTEGER DEFAULT 0,
    not_started_tasks INTEGER DEFAULT 0,
    total_planned_minutes INTEGER DEFAULT 0,
    total_completed_minutes INTEGER DEFAULT 0,
    completion_rate REAL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE(user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_statistics(user_id, stat_date);

CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    language TEXT DEFAULT 'ar',
    theme TEXT DEFAULT 'system' CHECK(theme IN ('light', 'dark', 'system')),
    notifications_enabled INTEGER DEFAULT 1,
    notification_sound INTEGER DEFAULT 1,
    notification_vibration INTEGER DEFAULT 1,
    default_reminder_minutes INTEGER DEFAULT 15,
    week_start_day INTEGER DEFAULT 6,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#9E9E9E',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

CREATE TABLE IF NOT EXISTS task_tags (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE(task_id, tag_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Views
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_plan_statistics AS
SELECT 
    p.id AS plan_id,
    p.user_id,
    p.name AS plan_name,
    p.status AS plan_status,
    COUNT(t.id) AS total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
    SUM(CASE WHEN t.status = 'partially_completed' THEN 1 ELSE 0 END) AS partial_tasks,
    SUM(CASE WHEN t.status = 'not_started' THEN 1 ELSE 0 END) AS not_started_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
    SUM(t.duration_minutes) AS total_planned_minutes,
    SUM(t.actual_duration_minutes) AS total_actual_minutes
FROM plans p
LEFT JOIN tasks t ON p.id = t.plan_id
GROUP BY p.id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Triggers
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_users_updated_at ON users;
CREATE TRIGGER tr_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_plans_updated_at ON plans;
CREATE TRIGGER tr_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_tasks_updated_at ON tasks;
CREATE TRIGGER tr_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_notes_updated_at ON notes;
CREATE TRIGGER tr_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.completed_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_tasks_completed_at ON tasks;
CREATE TRIGGER tr_tasks_completed_at
    BEFORE UPDATE OF status ON tasks
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION set_task_completed_at();

CREATE OR REPLACE FUNCTION create_user_settings_on_register()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_settings (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_create_user_settings ON users;
CREATE TRIGGER tr_create_user_settings
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_settings_on_register();
