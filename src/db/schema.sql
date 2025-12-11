-- Plans Management System Database Schema
-- PostgreSQL (Neon) compatible

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  planned_minutes INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session logs table
CREATE TABLE IF NOT EXISTS session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pomodoro', 'stopwatch', 'manual')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries

-- Index for fetching plans by user
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);

-- Index for fetching tasks by user
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

-- Index for fetching tasks by plan
CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);

-- Index for fetching tasks by date (common query for "today's tasks")
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);

-- Composite index for user + date queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);

-- Index for fetching session logs by task
CREATE INDEX IF NOT EXISTS idx_session_logs_task_id ON session_logs(task_id);

-- Index for fetching session logs by timestamp (for date filtering)
CREATE INDEX IF NOT EXISTS idx_session_logs_timestamp ON session_logs(timestamp);

-- Index for user email lookup (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
