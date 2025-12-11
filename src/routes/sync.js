const express = require('express');
const { query, getClient } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/sync/push - Receive local changes from client
 * Handles plans, tasks, and session_logs with conflict resolution
 * 
 * **Validates: Requirements 14.2**
 */
router.post('/push', async (req, res) => {
  const client = await getClient();
  
  try {
    const { plans, tasks, sessions } = req.body;
    const userId = req.user.id;
    
    await client.query('BEGIN');
    
    const results = {
      plans: { created: 0, updated: 0 },
      tasks: { created: 0, updated: 0 },
      sessions: { created: 0 }
    };

    // Process plans
    if (plans && Array.isArray(plans)) {
      for (const plan of plans) {
        const existing = await client.query(
          'SELECT id, updated_at FROM plans WHERE id = $1 AND user_id = $2',
          [plan.id, userId]
        );
        
        if (existing.rows.length === 0) {
          // Insert new plan
          await client.query(
            `INSERT INTO plans (id, user_id, title, description, target_hours, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [plan.id, userId, plan.title, plan.description, plan.targetHours, 
             plan.createdAt, plan.updatedAt]
          );
          results.plans.created++;
        } else {
          // Conflict resolution: use most recent updatedAt
          const serverUpdatedAt = new Date(existing.rows[0].updated_at);
          const clientUpdatedAt = new Date(plan.updatedAt);
          
          if (clientUpdatedAt > serverUpdatedAt) {
            await client.query(
              `UPDATE plans SET title = $1, description = $2, target_hours = $3, updated_at = $4
               WHERE id = $5 AND user_id = $6`,
              [plan.title, plan.description, plan.targetHours, plan.updatedAt, plan.id, userId]
            );
            results.plans.updated++;
          }
        }
      }
    }


    // Process tasks
    if (tasks && Array.isArray(tasks)) {
      for (const task of tasks) {
        // Verify plan belongs to user if planId provided
        if (task.planId) {
          const planCheck = await client.query(
            'SELECT id FROM plans WHERE id = $1 AND user_id = $2',
            [task.planId, userId]
          );
          if (planCheck.rows.length === 0) {
            // Skip task with invalid plan
            continue;
          }
        }
        
        const existing = await client.query(
          'SELECT id, updated_at FROM tasks WHERE id = $1 AND user_id = $2',
          [task.id, userId]
        );
        
        if (existing.rows.length === 0) {
          // Insert new task
          await client.query(
            `INSERT INTO tasks (id, user_id, plan_id, title, description, planned_minutes, date, is_completed, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [task.id, userId, task.planId, task.title, task.description, 
             task.plannedMinutes, task.date, task.isCompleted, task.createdAt, task.updatedAt]
          );
          results.tasks.created++;
        } else {
          // Conflict resolution: use most recent updatedAt
          const serverUpdatedAt = new Date(existing.rows[0].updated_at);
          const clientUpdatedAt = new Date(task.updatedAt);
          
          if (clientUpdatedAt > serverUpdatedAt) {
            await client.query(
              `UPDATE tasks SET plan_id = $1, title = $2, description = $3, planned_minutes = $4, 
               date = $5, is_completed = $6, updated_at = $7
               WHERE id = $8 AND user_id = $9`,
              [task.planId, task.title, task.description, task.plannedMinutes,
               task.date, task.isCompleted, task.updatedAt, task.id, userId]
            );
            results.tasks.updated++;
          }
        }
      }
    }

    // Process sessions (immutable - only insert if not exists)
    if (sessions && Array.isArray(sessions)) {
      for (const session of sessions) {
        // Verify task belongs to user
        const taskCheck = await client.query(
          'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
          [session.taskId, userId]
        );
        if (taskCheck.rows.length === 0) {
          // Skip session with invalid task
          continue;
        }
        
        const existing = await client.query(
          'SELECT id FROM session_logs WHERE id = $1',
          [session.id]
        );
        
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO session_logs (id, task_id, duration_minutes, type, timestamp)
             VALUES ($1, $2, $3, $4, $5)`,
            [session.id, session.taskId, session.durationMinutes, session.type, session.timestamp]
          );
          results.sessions.created++;
        }
      }
    }

    await client.query('COMMIT');
    
    res.json({
      success: true,
      results,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sync push error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});


/**
 * GET /api/sync/pull - Send server changes since timestamp
 * Query params: since (ISO timestamp)
 * 
 * **Validates: Requirements 14.3**
 */
router.get('/pull', async (req, res) => {
  try {
    const { since } = req.query;
    const userId = req.user.id;
    
    let plansQuery, tasksQuery, sessionsQuery;
    const params = [userId];
    
    if (since) {
      const sinceDate = new Date(since);
      params.push(sinceDate);
      
      plansQuery = `
        SELECT * FROM plans 
        WHERE user_id = $1 AND updated_at > $2
        ORDER BY updated_at DESC
      `;
      
      tasksQuery = `
        SELECT * FROM tasks 
        WHERE user_id = $1 AND updated_at > $2
        ORDER BY updated_at DESC
      `;
      
      sessionsQuery = `
        SELECT sl.* FROM session_logs sl
        JOIN tasks t ON t.id = sl.task_id
        WHERE t.user_id = $1 AND sl.timestamp > $2
        ORDER BY sl.timestamp DESC
      `;
    } else {
      // No since timestamp - return all data
      plansQuery = `
        SELECT * FROM plans 
        WHERE user_id = $1
        ORDER BY updated_at DESC
      `;
      
      tasksQuery = `
        SELECT * FROM tasks 
        WHERE user_id = $1
        ORDER BY updated_at DESC
      `;
      
      sessionsQuery = `
        SELECT sl.* FROM session_logs sl
        JOIN tasks t ON t.id = sl.task_id
        WHERE t.user_id = $1
        ORDER BY sl.timestamp DESC
      `;
    }
    
    const [plansResult, tasksResult, sessionsResult] = await Promise.all([
      query(plansQuery, params),
      query(tasksQuery, params),
      query(sessionsQuery, params)
    ]);
    
    const plans = plansResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      targetHours: row.target_hours,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    const tasks = tasksResult.rows.map(row => ({
      id: row.id,
      planId: row.plan_id,
      title: row.title,
      description: row.description,
      plannedMinutes: row.planned_minutes,
      date: row.date,
      isCompleted: row.is_completed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    const sessions = sessionsResult.rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      durationMinutes: row.duration_minutes,
      type: row.type,
      timestamp: row.timestamp
    }));
    
    res.json({
      plans,
      tasks,
      sessions,
      pulledAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
