const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/tasks - List tasks with date/plan filters
 * Query params: date (YYYY-MM-DD), planId
 */
router.get('/', async (req, res) => {
  try {
    const { date, planId } = req.query;
    
    let sql = `
      SELECT t.*, 
        COALESCE(SUM(sl.duration_minutes), 0) as total_logged_minutes
      FROM tasks t
      LEFT JOIN session_logs sl ON sl.task_id = t.id
      WHERE t.user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;
    
    if (date) {
      sql += ` AND t.date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    
    if (planId) {
      sql += ` AND t.plan_id = $${paramIndex}`;
      params.push(planId);
      paramIndex++;
    }
    
    sql += ' GROUP BY t.id ORDER BY t.date DESC, t.created_at DESC';
    
    const result = await query(sql, params);
    
    const tasks = result.rows.map(row => ({
      id: row.id,
      planId: row.plan_id,
      title: row.title,
      description: row.description,
      plannedMinutes: row.planned_minutes,
      date: row.date,
      isCompleted: row.is_completed,
      totalLoggedMinutes: parseInt(row.total_logged_minutes) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * GET /api/tasks/:id - Get a single task by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT t.*, 
        COALESCE(SUM(sl.duration_minutes), 0) as total_logged_minutes
       FROM tasks t
       LEFT JOIN session_logs sl ON sl.task_id = t.id
       WHERE t.id = $1 AND t.user_id = $2
       GROUP BY t.id`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      planId: row.plan_id,
      title: row.title,
      description: row.description,
      plannedMinutes: row.planned_minutes,
      date: row.date,
      isCompleted: row.is_completed,
      totalLoggedMinutes: parseInt(row.total_logged_minutes) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks - Create new task
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, plannedMinutes, date, planId } = req.body;
    
    // Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Title is required'] 
      });
    }
    
    if (!date) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Date is required'] 
      });
    }
    
    if (plannedMinutes !== undefined && (typeof plannedMinutes !== 'number' || plannedMinutes < 0)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Planned minutes must be a non-negative number'] 
      });
    }
    
    // Verify plan belongs to user if planId provided
    if (planId) {
      const planCheck = await query(
        'SELECT id FROM plans WHERE id = $1 AND user_id = $2',
        [planId, req.user.id]
      );
      if (planCheck.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: ['Invalid plan ID'] 
        });
      }
    }
    
    const result = await query(
      `INSERT INTO tasks (user_id, plan_id, title, description, planned_minutes, date) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [req.user.id, planId || null, title.trim(), description || null, plannedMinutes || 0, date]
    );
    
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      planId: row.plan_id,
      title: row.title,
      description: row.description,
      plannedMinutes: row.planned_minutes,
      date: row.date,
      isCompleted: row.is_completed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/tasks/:id - Update task
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, plannedMinutes, date, planId, isCompleted } = req.body;
    
    // Check if task exists and belongs to user
    const existingTask = await query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Validation
    if (title !== undefined && title.trim() === '') {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Title cannot be empty'] 
      });
    }
    
    if (plannedMinutes !== undefined && (typeof plannedMinutes !== 'number' || plannedMinutes < 0)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Planned minutes must be a non-negative number'] 
      });
    }
    
    // Verify plan belongs to user if planId provided
    if (planId) {
      const planCheck = await query(
        'SELECT id FROM plans WHERE id = $1 AND user_id = $2',
        [planId, req.user.id]
      );
      if (planCheck.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: ['Invalid plan ID'] 
        });
      }
    }
    
    const result = await query(
      `UPDATE tasks 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           planned_minutes = COALESCE($3, planned_minutes),
           date = COALESCE($4, date),
           plan_id = COALESCE($5, plan_id),
           is_completed = COALESCE($6, is_completed),
           updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [title?.trim(), description, plannedMinutes, date, planId, isCompleted, id, req.user.id]
    );
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      planId: row.plan_id,
      title: row.title,
      description: row.description,
      plannedMinutes: row.planned_minutes,
      date: row.date,
      isCompleted: row.is_completed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tasks/:id - Delete task
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
