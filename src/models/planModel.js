const db = require('../db');

class PlanModel {
    static async create({ user_id, name, description, plan_type, start_date, end_date, image_path, priority, color }) {
        const text = `
      INSERT INTO plans (user_id, name, description, plan_type, start_date, end_date, image_path, status, priority, color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'not_started', $8, $9)
      RETURNING *
    `;
        const values = [user_id, name, description, plan_type || 'other', start_date, end_date, image_path, priority || 2, color || '#4CAF50'];
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async findAllByUserId(user_id) {
        // Order by priority (1 = highest) then by display_order, then by created_at
        const text = 'SELECT * FROM plans WHERE user_id = $1 ORDER BY priority ASC, display_order ASC, created_at DESC';
        const { rows } = await db.query(text, [user_id]);
        return rows;
    }

    static async findById(id) {
        const text = 'SELECT * FROM plans WHERE id = $1';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }

    static async update(id, updates) {
        const allowedFields = ['name', 'description', 'plan_type', 'start_date', 'end_date',
            'image_path', 'status', 'priority', 'display_order', 'color',
            'daily_goal_minutes', 'reminders_enabled'];
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
        const text = `UPDATE plans SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async delete(id) {
        const text = 'DELETE FROM plans WHERE id = $1 RETURNING id';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }

    // Update display order for multiple plans
    static async updateOrder(plan_orders) {
        // plan_orders = [{ id: 1, display_order: 0 }, { id: 2, display_order: 1 }, ...]
        for (const { id, display_order } of plan_orders) {
            await db.query('UPDATE plans SET display_order = $1 WHERE id = $2', [display_order, id]);
        }
        return true;
    }
}

module.exports = PlanModel;
