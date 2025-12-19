const db = require('../db');

class PlanModel {
    static async create({ user_id, name, description, plan_type, start_date, end_date, image_path }) {
        const text = `
      INSERT INTO plans (user_id, name, description, plan_type, start_date, end_date, image_path, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'not_started')
      RETURNING *
    `;
        const values = [user_id, name, description, plan_type, start_date, end_date, image_path];
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async findAllByUserId(user_id) {
        const text = 'SELECT * FROM plans WHERE user_id = $1 ORDER BY created_at DESC';
        const { rows } = await db.query(text, [user_id]);
        return rows;
    }

    static async findById(id) {
        const text = 'SELECT * FROM plans WHERE id = $1';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }

    static async update(id, updates) {
        /* 
           Dynamic update query builder.
           Note: In a real app, strict validation is needed.
        */
        const keys = Object.keys(updates);
        const values = Object.values(updates);

        if (keys.length === 0) return null;

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const text = `UPDATE plans SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;

        const { rows } = await db.query(text, [...values, id]);
        return rows[0];
    }

    static async delete(id) {
        const text = 'DELETE FROM plans WHERE id = $1 RETURNING id';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }
}

module.exports = PlanModel;
