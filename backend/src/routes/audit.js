import express from 'express';
import { getDb } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get audit log (admin only)
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { limit = 100, entity_type, user_id } = req.query;

    let query = `
      SELECT a.*, u.username, u.name as user_name, u.role as user_role
      FROM audit_log a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (entity_type) {
      query += ' AND a.entity_type = ?';
      params.push(entity_type);
    }
    if (user_id) {
      query += ' AND a.user_id = ?';
      params.push(parseInt(user_id));
    }

    query += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Get audit log for specific entity
router.get('/entity/:entityType/:entityId', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { entityType, entityId } = req.params;

    const logs = db.prepare(`
      SELECT a.*, u.username, u.name as user_name, u.role as user_role
      FROM audit_log a
      JOIN users u ON a.user_id = u.id
      WHERE a.entity_type = ? AND a.entity_id = ?
      ORDER BY a.created_at DESC
    `).all(entityType, parseInt(entityId));

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch entity audit log' });
  }
});

export default router;
