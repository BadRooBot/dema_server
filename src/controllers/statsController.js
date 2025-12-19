const db = require('../db');

const getDashboardStats = async (req, res) => {
  const user_id = req.user.id;

  try {
    // 1. Task Counts by Status - specify table alias for status column
    const statusQuery = `
      SELECT t.status, COUNT(*) as count 
      FROM tasks t
      JOIN plans p ON t.plan_id = p.id
      WHERE p.user_id = $1
      GROUP BY t.status
    `;
    const { rows: statusRows } = await db.query(statusQuery, [user_id]);

    // 2. Duration Stats (Completed vs Planned)
    const durationQuery = `
      SELECT 
        SUM(t.duration_minutes) as planned_minutes,
        SUM(t.actual_duration_minutes) as completed_minutes
      FROM tasks t
      JOIN plans p ON t.plan_id = p.id
      WHERE p.user_id = $1 AND t.status IN ('completed', 'partially_completed')
    `;
    const { rows: durationRows } = await db.query(durationQuery, [user_id]);

    const stats = {
      task_counts: statusRows.reduce((acc, row) => ({ ...acc, [row.status]: parseInt(row.count) }), {}),
      time_stats: {
        planned_minutes: parseInt(durationRows[0]?.planned_minutes || 0),
        completed_minutes: parseInt(durationRows[0]?.completed_minutes || 0),
      }
    };

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDashboardStats };
