require('dotenv').config();

const { pool } = require('./index');

/**
 * Database migration script
 * Creates all required tables for the Plans Management System
 */
const migrate = async () => {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...');
    
    await client.query('BEGIN');
    
    // Enable UUID extension
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);
    console.log('✓ Enabled pgcrypto extension');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ Created users table');
    
    // Create plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        target_hours INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ Created plans table');

    // Create tasks table
    await client.query(`
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
    `);
    console.log('✓ Created tasks table');
    
    // Create session_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        duration_minutes INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('pomodoro', 'stopwatch', 'manual')),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ Created session_logs table');
    
    // Create indexes for common queries
    
    // Index for fetching plans by user
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
    `);
    console.log('✓ Created index: idx_plans_user_id');
    
    // Index for fetching tasks by user
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    `);
    console.log('✓ Created index: idx_tasks_user_id');
    
    // Index for fetching tasks by plan
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);
    `);
    console.log('✓ Created index: idx_tasks_plan_id');
    
    // Index for fetching tasks by date (common query for "today's tasks")
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
    `);
    console.log('✓ Created index: idx_tasks_date');
    
    // Composite index for user + date queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
    `);
    console.log('✓ Created index: idx_tasks_user_date');
    
    // Index for fetching session logs by task
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_logs_task_id ON session_logs(task_id);
    `);
    console.log('✓ Created index: idx_session_logs_task_id');
    
    // Index for fetching session logs by timestamp (for date filtering)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_logs_timestamp ON session_logs(timestamp);
    `);
    console.log('✓ Created index: idx_session_logs_timestamp');
    
    // Index for user email lookup (login)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('✓ Created index: idx_users_email');
    
    await client.query('COMMIT');
    
    console.log('\n✅ Database migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrate };
