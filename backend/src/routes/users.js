import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/database.js';
import { authenticateToken, requireRole, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT id, username, name, role, is_active, created_at
      FROM users
      ORDER BY role, username
    `).all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Change password (admin only)
router.put('/:id/password', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { password } = req.body;
    const id = req.params.id;

    // Strong password validation
    if (!password || password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent changing own password through this endpoint (use separate endpoint for that)
    if (user.id === req.user.id) {
      return res.status(400).json({ 
        error: 'Please use the change password endpoint to update your own password' 
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id);

    logAudit(db, req.user.id, 'UPDATE_PASSWORD', 'user', id, null, { username: user.username });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
