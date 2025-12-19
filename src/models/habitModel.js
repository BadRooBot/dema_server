const db = require('../db');

const HabitModel = {
    create: async ({ user_id, name, description, icon, color, target_days, reminder_time }) => {
        const { rows } = await db.query(
            `INSERT INTO habits (user_id, name, description, icon, color, target_days, reminder_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [user_id, name, description, icon || '✓', color || '#4CAF50', target_days || '1111111', reminder_time]
        );
        return rows[0];
    },

    findAllByUserId: async (user_id) => {
        const { rows } = await db.query(
            'SELECT * FROM habits WHERE user_id = $1 AND is_active = 1 ORDER BY created_at DESC',
            [user_id]
        );
        return rows;
    },

    findById: async (id) => {
        const { rows } = await db.query('SELECT * FROM habits WHERE id = $1', [id]);
        return rows[0];
    },

    update: async (id, updates) => {
        const allowedFields = ['name', 'description', 'icon', 'color', 'target_days', 'reminder_time', 'is_active'];
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
        const { rows } = await db.query(
            `UPDATE habits SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return rows[0];
    },

    delete: async (id) => {
        await db.query('DELETE FROM habits WHERE id = $1', [id]);
        return true;
    },

    // Check-ins
    checkIn: async (habit_id, check_date, notes) => {
        const { rows } = await db.query(
            `INSERT INTO habit_check_ins (habit_id, check_date, is_completed, notes)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (habit_id, check_date) 
       DO UPDATE SET is_completed = 1, notes = COALESCE($3, habit_check_ins.notes)
       RETURNING *`,
            [habit_id, check_date, notes]
        );
        return rows[0];
    },

    uncheckIn: async (habit_id, check_date) => {
        await db.query(
            'DELETE FROM habit_check_ins WHERE habit_id = $1 AND check_date = $2',
            [habit_id, check_date]
        );
        return true;
    },

    getCheckInsForMonth: async (habit_id, year, month) => {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

        const { rows } = await db.query(
            `SELECT check_date, is_completed, notes 
       FROM habit_check_ins 
       WHERE habit_id = $1 AND check_date >= $2 AND check_date <= $3
       ORDER BY check_date`,
            [habit_id, startDate, endDate]
        );
        return rows;
    },

    getStats: async (habit_id) => {
        // Total check-ins
        const totalResult = await db.query(
            'SELECT COUNT(*) as total FROM habit_check_ins WHERE habit_id = $1',
            [habit_id]
        );

        // This month
        const monthResult = await db.query(
            `SELECT COUNT(*) as count FROM habit_check_ins 
       WHERE habit_id = $1 AND check_date >= DATE_TRUNC('month', CURRENT_DATE)`,
            [habit_id]
        );

        // Current streak
        const streakResult = await db.query(
            `WITH dates AS (
         SELECT check_date, 
                check_date - (ROW_NUMBER() OVER (ORDER BY check_date))::INTEGER as grp
         FROM habit_check_ins 
         WHERE habit_id = $1
         ORDER BY check_date DESC
       )
       SELECT COUNT(*) as streak
       FROM dates
       WHERE grp = (SELECT grp FROM dates WHERE check_date = CURRENT_DATE LIMIT 1)`,
            [habit_id]
        );

        return {
            total_check_ins: parseInt(totalResult.rows[0]?.total || 0),
            monthly_check_ins: parseInt(monthResult.rows[0]?.count || 0),
            current_streak: parseInt(streakResult.rows[0]?.streak || 0),
        };
    },

    // Get habits with today's check-in status
    getHabitsWithTodayStatus: async (user_id, date) => {
        const dayOfWeek = new Date(date).getDay();

        const { rows } = await db.query(
            `SELECT h.*, 
              CASE WHEN hc.id IS NOT NULL THEN 1 ELSE 0 END as is_checked_today
       FROM habits h
       LEFT JOIN habit_check_ins hc ON h.id = hc.habit_id AND hc.check_date = $2
       WHERE h.user_id = $1 AND h.is_active = 1
         AND SUBSTRING(h.target_days FROM ($3 + 1) FOR 1) = '1'
       ORDER BY h.created_at`,
            [user_id, date, dayOfWeek]
        );
        return rows;
    }
};

module.exports = HabitModel;
