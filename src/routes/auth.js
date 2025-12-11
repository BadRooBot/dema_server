const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register - User registration
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Email and password are required'] 
      });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Invalid email format'] 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Password must be at least 6 characters'] 
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Conflict', 
        message: 'User with this email already exists' 
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash) 
       VALUES ($1, $2) 
       RETURNING id, email, created_at`,
      [email.toLowerCase(), passwordHash]
    );
    
    const user = result.rows[0];
    const token = generateToken(user.id, user.email);
    
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login - User login with JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: ['Email and password are required'] 
      });
    }
    
    // Find user
    const result = await query(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user.id, user.email);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = router;
