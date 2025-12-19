const db = require('../db');

const TaskModel = {
    create: async (taskData) => {
        const {
            plan_id, title, description, duration_minutes, task_date, start_time,
            is_recurring, recurrence_pattern, repeat_days, priority
        } = taskData;

        const { rows } = await db.query(
            `INSERT INTO tasks 
        (plan_id, title, description, duration_minutes, task_date, start_time, 
         is_recurring, recurrence_pattern, repeat_days, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
            [plan_id, title, description, duration_minutes, task_date, start_time,
                is_recurring ? 1 : 0, recurrence_pattern, repeat_days, priority || 2]
        );
        return rows[0];
    },

    findById: async (id) => {
        const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
        return rows[0];
    },

    findAllByPlanId: async (plan_id) => {
        const { rows } = await db.query(
            'SELECT * FROM tasks WHERE plan_id = $1 ORDER BY priority ASC, created_at DESC',
            [plan_id]
        );
        return rows;
    },

    // Get tasks for a specific date - sorted by PLAN priority first, then task priority
    findByDate: async (user_id, date) => {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();

        const { rows } = await db.query(`
      SELECT 
        t.*,
        p.start_date as plan_start_date,
        p.end_date as plan_end_date,
        p.name as plan_name,
        p.priority as plan_priority,
        p.color as plan_color,
        COALESCE(dti.status, t.status) as instance_status,
        COALESCE(dti.actual_duration_minutes, 0) as instance_actual_duration
      FROM tasks t
      JOIN plans p ON t.plan_id = p.id
      LEFT JOIN daily_task_instances dti ON t.id = dti.task_id AND dti.instance_date = $2
      WHERE p.user_id = $1
        AND (
          (t.is_recurring = 0 AND t.task_date = $2)
          OR
          (t.is_recurring = 1 
           AND $2 >= p.start_date 
           AND $2 <= p.end_date
           AND (
             t.repeat_days IS NULL 
             OR SUBSTRING(t.repeat_days FROM ($3 + 1) FOR 1) = '1'
           )
          )
        )
      ORDER BY p.priority ASC, t.priority ASC, t.start_time, t.created_at
    `, [user_id, date, dayOfWeek]);

        return rows;
    },

    update: async (id, updates) => {
        const fields = [];
        const values = [];
        let paramCount = 1;

        const allowedFields = [
            'title', 'description', 'duration_minutes', 'task_date',
            'start_time', 'status', 'progress', 'actual_duration_minutes',
            'priority', 'color', 'is_recurring', 'recurrence_pattern', 'repeat_days'
        ];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (fields.length === 0) return null;

        values.push(id);
        const { rows } = await db.query(
            `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return rows[0];
    },

    delete: async (id) => {
        await db.query('DELETE FROM tasks WHERE id = $1', [id]);
        return true;
    },

    getOrCreateInstance: async (task_id, instance_date) => {
        let { rows } = await db.query(
            'SELECT * FROM daily_task_instances WHERE task_id = $1 AND instance_date = $2',
            [task_id, instance_date]
        );

        if (rows.length > 0) return rows[0];

        const result = await db.query(
            `INSERT INTO daily_task_instances (task_id, instance_date) VALUES ($1, $2) RETURNING *`,
            [task_id, instance_date]
        );
        return result.rows[0];
    },

    updateInstance: async (task_id, instance_date, updates) => {
        await TaskModel.getOrCreateInstance(task_id, instance_date);

        const fields = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (['status', 'actual_duration_minutes'].includes(key)) {
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (updates.status === 'completed') {
            fields.push(`completed_at = CURRENT_TIMESTAMP`);
        }

        if (fields.length === 0) return null;

        values.push(task_id, instance_date);
        const { rows } = await db.query(
            `UPDATE daily_task_instances 
       SET ${fields.join(', ')} 
       WHERE task_id = $${paramCount} AND instance_date = $${paramCount + 1}
       RETURNING *`,
            values
        );
        return rows[0];
    }
};

module.exports = TaskModel;
