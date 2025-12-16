const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/plans - List all plans for user
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, 
        COALESCE(SUM(sl.duration_minutes), 0) as total_logged_minutes
       FROM plans p
       LEFT JOIN tasks t ON t.plan_id = p.id
       LEFT JOIN session_logs sl ON sl.task_id = t.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    
    const plans = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      targetHours: row.target_hours,
      startDate: row.start_date,
      endDate: row.end_date,
      backgroundImagePath: row.background_image_path,
      notes: row.notes,
      priority: row.priority || 'medium',
      totalLoggedMinutes: parseInt(row.total_logged_minutes) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * GET /api/plans/:id - Get a single plan by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT p.*, 
        COALESCE(SUM(sl.duration_minutes), 0) as total_logged_minutes
       FROM plans p
       LEFT JOIN tasks t ON t.plan_id = p.id
       LEFT JOIN session_logs sl ON sl.task_id = t.id
       WHERE p.id = $1 AND p.user_id = $2
       GROUP BY p.id`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      targetHours: row.target_hours,
      startDate: row.start_date,
      endDate: row.end_date,
      backgroundImagePath: row.background_image_path,
      notes: row.notes,
      priority: row.priority || 'medium',
      totalLoggedMinutes: parseInt(row.total_logged_minutes) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/plans - Create new plan
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, targetHours, startDate, endDate, backgroundImagePath, notes, priority } = req.body;
    
    // Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Title is required'] 
      });
    }
    
    if (targetHours !== undefined && (typeof targetHours !== 'number' || targetHours < 0)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Target hours must be a non-negative number'] 
      });
    }

    if (priority !== undefined && !['high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Priority must be high, medium, or low'] 
      });
    }
    
    const result = await query(
      `INSERT INTO plans (user_id, title, description, target_hours, start_date, end_date, background_image_path, notes, priority) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [req.user.id, title.trim(), description || null, targetHours || 0, startDate || null, endDate || null, backgroundImagePath || null, notes || null, priority || 'medium']
    );
    
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      targetHours: row.target_hours,
      startDate: row.start_date,
      endDate: row.end_date,
      backgroundImagePath: row.background_image_path,
      notes: row.notes,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/plans/:id - Update plan
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, targetHours, startDate, endDate, backgroundImagePath, notes, priority } = req.body;
    
    // Check if plan exists and belongs to user
    const existingPlan = await query(
      'SELECT id FROM plans WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (existingPlan.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Validation
    if (title !== undefined && title.trim() === '') {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Title cannot be empty'] 
      });
    }
    
    if (targetHours !== undefined && (typeof targetHours !== 'number' || targetHours < 0)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Target hours must be a non-negative number'] 
      });
    }

    if (priority !== undefined && !['high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Priority must be high, medium, or low'] 
      });
    }
    
    const result = await query(
      `UPDATE plans 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           target_hours = COALESCE($3, target_hours),
           start_date = COALESCE($4, start_date),
           end_date = COALESCE($5, end_date),
           background_image_path = COALESCE($6, background_image_path),
           notes = COALESCE($7, notes),
           priority = COALESCE($8, priority),
           updated_at = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [title?.trim(), description, targetHours, startDate, endDate, backgroundImagePath, notes, priority, id, req.user.id]
    );
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      targetHours: row.target_hours,
      startDate: row.start_date,
      endDate: row.end_date,
      backgroundImagePath: row.background_image_path,
      notes: row.notes,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/plans/:id - Delete plan
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM plans WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
