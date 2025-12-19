const db = require('../db');

class TaskModel {
    static async create(task) {
        const {
            plan_id, title, description, duration_minutes, task_date, start_time,
            is_recurring, recurrence_pattern, repeat_days, priority
        } = task;

        const text = `
      INSERT INTO tasks (
        plan_id, title, description, duration_minutes, task_date, start_time,
        is_recurring, recurrence_pattern, repeat_days, priority, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'not_started')
      RETURNING *
    `;
        const values = [
            plan_id, title, description, duration_minutes, task_date, start_time,
            is_recurring, recurrence_pattern, repeat_days, priority
        ];
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async createMany(tasks) {
        if (tasks.length === 0) return [];

        // Construct query for batch insert
        // ($1, $2, ...), ($11, $12, ...)
        const keys = [
            'plan_id', 'title', 'description', 'duration_minutes', 'task_date',
            'start_time', 'is_recurring', 'recurrence_pattern', 'repeat_days', 'priority', 'status'
        ];

        let query = `INSERT INTO tasks (${keys.join(', ')}) VALUES `;
        const values = [];
        let placeholderIndex = 1;

        tasks.forEach((task, index) => {
            const taskValues = [
                task.plan_id, task.title, task.description, task.duration_minutes, task.task_date,
                task.start_time, task.is_recurring, task.recurrence_pattern, task.repeat_days, task.priority, 'not_started'
            ];

            const placeholders = taskValues.map(() => `$${placeholderIndex++}`).join(', ');
            query += `(${placeholders})${index === tasks.length - 1 ? '' : ', '}`;
            values.push(...taskValues);
        });

        query += ' RETURNING *';

        const { rows } = await db.query(query, values);
        return rows;
    }

    static async findAllByPlanId(plan_id) {
        const text = 'SELECT * FROM tasks WHERE plan_id = $1 ORDER BY task_date, start_time';
        const { rows } = await db.query(text, [plan_id]);
        return rows;
    }

    // Find tasks for a specific user on a specific date (across all their plans)
    static async findByDate(user_id, date) {
        const text = `
      SELECT t.*, p.name as plan_name, p.color as plan_color
      FROM tasks t
      JOIN plans p ON t.plan_id = p.id
      WHERE p.user_id = $1 AND t.task_date = $2
      ORDER BY t.start_time
    `;
        const { rows } = await db.query(text, [user_id, date]);
        return rows;
    }

    static async findById(id) {
        const text = 'SELECT * FROM tasks WHERE id = $1';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }

    static async update(id, updates) {
        const keys = Object.keys(updates);
        const values = Object.values(updates);

        if (keys.length === 0) return null;

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const text = `UPDATE tasks SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;

        const { rows } = await db.query(text, [...values, id]);
        return rows[0];
    }

    static async delete(id) {
        const text = 'DELETE FROM tasks WHERE id = $1 RETURNING id';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }
}

module.exports = TaskModel;
