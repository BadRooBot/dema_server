const db = require('../db');

class NoteModel {
    static async create({ user_id, plan_id, task_id, title, content, color }) {
        const text = `
      INSERT INTO notes (user_id, plan_id, task_id, title, content, color)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const values = [user_id, plan_id || null, task_id || null, title, content, color || '#FFEB3B'];
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    // Atomic findOrCreate using CTE - prevents race conditions
    static async findOrCreate({ user_id, plan_id, task_id, title, content, color }) {
        const sanitizedTitle = title ? title.trim() : title;
        const text = `
            WITH existing AS (
                SELECT * FROM notes 
                WHERE user_id = $1 
                AND (plan_id = $2 OR ($2 IS NULL AND plan_id IS NULL))
                AND TRIM(COALESCE(title, '')) = COALESCE($4, '')
                AND content = $5
                LIMIT 1
            ),
            inserted AS (
                INSERT INTO notes (user_id, plan_id, task_id, title, content, color)
                SELECT $1, $2, $3, $4, $5, $6
                WHERE NOT EXISTS (SELECT 1 FROM existing)
                RETURNING *
            )
            SELECT *, 'existing' as _source FROM existing
            UNION ALL
            SELECT *, 'inserted' as _source FROM inserted
            LIMIT 1
        `;
        const values = [user_id, plan_id || null, task_id || null, sanitizedTitle, content, color || '#FFEB3B'];
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async findAllByUserId(user_id) {
        const text = 'SELECT * FROM notes WHERE user_id = $1 ORDER BY is_pinned DESC, created_at DESC';
        const { rows } = await db.query(text, [user_id]);
        return rows;
    }

    static async findByPlanId(plan_id) {
        const text = 'SELECT * FROM notes WHERE plan_id = $1 ORDER BY is_pinned DESC, created_at DESC';
        const { rows } = await db.query(text, [plan_id]);
        return rows;
    }

    static async findByTaskId(task_id) {
        const text = 'SELECT * FROM notes WHERE task_id = $1 ORDER BY created_at DESC';
        const { rows } = await db.query(text, [task_id]);
        return rows;
    }

    static async findById(id) {
        const text = 'SELECT * FROM notes WHERE id = $1';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }

    static async update(id, updates) {
        const allowedFields = ['title', 'content', 'color', 'is_pinned', 'is_archived'];
        const fields = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (fields.length === 0) return null;

        values.push(id);
        const text = `UPDATE notes SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async delete(id) {
        const text = 'DELETE FROM notes WHERE id = $1 RETURNING id';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }
}

module.exports = NoteModel;
