const db = require('../db');

class UserModel {
    static async create({ name, email, password }) {
        const text = `
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
    `;
        const values = [name, email, password];
        const { rows } = await db.query(text, values);
        return rows[0];
    }

    static async findByEmail(email) {
        const text = 'SELECT * FROM users WHERE email = $1';
        const { rows } = await db.query(text, [email]);
        return rows[0];
    }

    static async findById(id) {
        const text = 'SELECT id, name, email, avatar, phone, created_at FROM users WHERE id = $1';
        const { rows } = await db.query(text, [id]);
        return rows[0];
    }
}

module.exports = UserModel;
