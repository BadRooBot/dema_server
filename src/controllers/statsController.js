const db = require('../db');
const PlanModel = require('../models/planModel');

const getDashboardStats = async (req, res) => {
  const user_id = req.user.id;

  try {
    // Task Counts by Status (non-recurring + instances)
    const statusQuery = `
          WITH task_stats AS (
            SELECT t.status, t.duration_minutes, t.actual_duration_minutes
            FROM tasks t
            JOIN plans p ON t.plan_id = p.id
            WHERE p.user_id = $1 AND t.is_recurring = 0
            
            UNION ALL
            
            SELECT dti.status, t.duration_minutes, dti.actual_duration_minutes
            FROM daily_task_instances dti
            JOIN tasks t ON dti.task_id = t.id
            JOIN plans p ON t.plan_id = p.id
            WHERE p.user_id = $1
          )
          SELECT status, COUNT(*) as count 
          FROM task_stats
          GROUP BY status
        `;
    const { rows: statusRows } = await db.query(statusQuery, [user_id]);

    // Duration Stats
    const durationQuery = `
          WITH completed_stats AS (
            SELECT t.duration_minutes as planned, t.actual_duration_minutes as actual
            FROM tasks t
            JOIN plans p ON t.plan_id = p.id
            WHERE p.user_id = $1 AND t.is_recurring = 0 
              AND t.status IN ('completed', 'partially_completed')
            
            UNION ALL
            
            SELECT t.duration_minutes as planned, dti.actual_duration_minutes as actual
            FROM daily_task_instances dti
            JOIN tasks t ON dti.task_id = t.id
            JOIN plans p ON t.plan_id = p.id
            WHERE p.user_id = $1 
              AND dti.status IN ('completed', 'partially_completed')
          )
          SELECT 
            COALESCE(SUM(planned), 0) as planned_minutes,
            COALESCE(SUM(actual), 0) as completed_minutes
          FROM completed_stats
        `;
    const { rows: durationRows } = await db.query(durationQuery, [user_id]);

    res.json({
      task_counts: statusRows.reduce((acc, row) => ({ ...acc, [row.status]: parseInt(row.count) }), {}),
      time_stats: {
        planned_minutes: parseInt(durationRows[0]?.planned_minutes || 0),
        completed_minutes: parseInt(durationRows[0]?.completed_minutes || 0),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get statistics for a specific plan
const getPlanStats = async (req, res) => {
  const { plan_id } = req.params;
  const { period } = req.query; // 'week', 'month', or 'all'

  try {
    // Verify ownership
    const plan = await PlanModel.findById(plan_id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    if (plan.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    // Build date filter
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND (t.task_date >= CURRENT_DATE - INTERVAL '7 days' OR dti.instance_date >= CURRENT_DATE - INTERVAL '7 days')";
    } else if (period === 'month') {
      dateFilter = "AND (t.task_date >= CURRENT_DATE - INTERVAL '30 days' OR dti.instance_date >= CURRENT_DATE - INTERVAL '30 days')";
    }

    // Count tasks by status for this plan
    const statsQuery = `
          WITH plan_task_stats AS (
            -- Non-recurring tasks
            SELECT 
              t.status,
              t.duration_minutes,
              t.actual_duration_minutes,
              t.task_date as relevant_date
            FROM tasks t
            WHERE t.plan_id = $1 AND t.is_recurring = 0
            
            UNION ALL
            
            -- Recurring task instances
            SELECT 
              COALESCE(dti.status, 'not_started') as status,
              t.duration_minutes,
              COALESCE(dti.actual_duration_minutes, 0) as actual_duration_minutes,
              dti.instance_date as relevant_date
            FROM tasks t
            LEFT JOIN daily_task_instances dti ON t.id = dti.task_id
            WHERE t.plan_id = $1 AND t.is_recurring = 1 AND dti.id IS NOT NULL
          )
          SELECT 
            status,
            COUNT(*) as count,
            COALESCE(SUM(duration_minutes), 0) as total_planned,
            COALESCE(SUM(actual_duration_minutes), 0) as total_actual
          FROM plan_task_stats
          ${period ? `WHERE relevant_date >= CURRENT_DATE - INTERVAL '${period === 'week' ? '7' : '30'} days'` : ''}
          GROUP BY status
        `;

    const { rows: statsRows } = await db.query(statsQuery, [plan_id]);

    // Calculate totals
    let totalTasks = 0;
    let completedTasks = 0;
    let partialTasks = 0;
    let totalPlanned = 0;
    let totalActual = 0;

    statsRows.forEach(row => {
      const count = parseInt(row.count);
      totalTasks += count;
      totalPlanned += parseInt(row.total_planned);
      totalActual += parseInt(row.total_actual);

      if (row.status === 'completed') completedTasks = count;
      if (row.status === 'partially_completed') partialTasks = count;
    });

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    res.json({
      plan_id: parseInt(plan_id),
      period: period || 'all',
      task_counts: {
        total: totalTasks,
        completed: completedTasks,
        partially_completed: partialTasks,
        not_started: totalTasks - completedTasks - partialTasks,
      },
      time_stats: {
        total_planned_minutes: totalPlanned,
        total_actual_minutes: totalActual,
        planned_hours: Math.round(totalPlanned / 60 * 10) / 10,
        actual_hours: Math.round(totalActual / 60 * 10) / 10,
      },
      completion_rate: Math.round(completionRate * 10) / 10,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDashboardStats, getPlanStats };
