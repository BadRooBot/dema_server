const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

const VALID_SESSION_TYPES = ['pomodoro', 'stopwatch', 'manual'];

/**
 * GET /api/sessions - List sessions with filters
 * Query params: taskId, date (YYYY-MM-DD), startDate, endDate
 */
router.get('/', async (req, res) => {
  try {
    const { taskId, date, startDate, endDate } = req.query;
    
    let sql = `
      SELECT sl.*, t.title as task_title
      FROM session_logs sl
      JOIN tasks t ON t.id = sl.task_id
      WHERE t.user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;
    
    if (taskId) {
      sql += ` AND sl.task_id = $${paramIndex}`;
      params.push(taskId);
      paramIndex++;
    }
    
    if (date) {
      sql += ` AND DATE(sl.timestamp) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    
    if (startDate) {
      sql += ` AND sl.timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      sql += ` AND sl.timestamp <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    sql += ' ORDER BY sl.timestamp DESC';
    
    const result = await query(sql, params);
    
    const sessions = result.rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      durationMinutes: row.duration_minutes,
      type: row.type,
      timestamp: row.timestamp
    }));
    
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * GET /api/sessions/:id - Get a single session by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT sl.*, t.title as task_title
       FROM session_logs sl
       JOIN tasks t ON t.id = sl.task_id
       WHERE sl.id = $1 AND t.user_id = $2`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      durationMinutes: row.duration_minutes,
      type: row.type,
      timestamp: row.timestamp
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sessions - Create session log
 */
router.post('/', async (req, res) => {
  try {
    const { taskId, durationMinutes, type, timestamp } = req.body;
    
    // Validation
    if (!taskId) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Task ID is required'] 
      });
    }
    
    if (durationMinutes === undefined || typeof durationMinutes !== 'number' || durationMinutes < 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Duration minutes must be a non-negative number'] 
      });
    }
    
    if (!type || !VALID_SESSION_TYPES.includes(type)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: [`Type must be one of: ${VALID_SESSION_TYPES.join(', ')}`] 
      });
    }
    
    // Verify task belongs to user
    const taskCheck = await query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, req.user.id]
    );
    
    if (taskCheck.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Invalid task ID'] 
      });
    }
    
    const result = await query(
      `INSERT INTO session_logs (task_id, duration_minutes, type, timestamp) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [taskId, durationMinutes, type, timestamp || new Date().toISOString()]
    );
    
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      taskId: row.task_id,
      durationMinutes: row.duration_minutes,
      type: row.type,
      timestamp: row.timestamp
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sessions/stats/daily - Get daily statistics
 * Query params: date (YYYY-MM-DD)
 */
router.get('/stats/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const result = await query(
      `SELECT 
        COUNT(CASE WHEN sl.type = 'pomodoro' THEN 1 END) as pomodoro_count,
        COALESCE(SUM(sl.duration_minutes), 0) as total_minutes
       FROM session_logs sl
       JOIN tasks t ON t.id = sl.task_id
       WHERE t.user_id = $1 AND DATE(sl.timestamp) = $2`,
      [req.user.id, targetDate]
    );
    
    const row = result.rows[0];
    res.json({
      date: targetDate,
      pomodoroCount: parseInt(row.pomodoro_count) || 0,
      totalMinutes: parseInt(row.total_minutes) || 0,
      totalHours: Math.round((parseInt(row.total_minutes) || 0) / 60 * 100) / 100
    });
  } catch (error) {
    console.error('Get daily stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
