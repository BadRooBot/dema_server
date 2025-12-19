const db = require('../db');

class NoteModel {
    static async create({ user_id, plan_id, task_id, title, content, color }) {
        const text = `
      INSERT INTO notes (user_id, plan_id, task_id, title, content, color)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const values = [user_id, plan_id, task_id, title, content, color];
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async findAllByUserId(user_id) {
        const text = 'SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC';
        const { rows } = await db.query(text, [user_id]);
        return rows;
    }

    static async findById(id) {
        const text = 'SELECT * FROM notes WHERE id = $1';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }

    static async update(id, updates) {
        const keys = Object.keys(updates);
        const values = Object.values(updates);
        if (keys.length === 0) return null;
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const text = `UPDATE notes SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
        const { rows } = await db.query(text, [...values, id]);
        return rows[0];
    }

    static async delete(id) {
        const text = 'DELETE FROM notes WHERE id = $1 RETURNING id';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }
}

module.exports = NoteModel;
