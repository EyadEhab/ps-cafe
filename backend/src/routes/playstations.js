import express from 'express';
import { getDb } from '../config/database.js';
import { authenticateToken, requireRole, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Get all PlayStations
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const playstations = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM sessions s WHERE s.playstation_id = p.id AND s.status = 'active') as active_sessions
      FROM playstations p
      ORDER BY p.id
    `).all();
    res.json(playstations);
  } catch (error) {
    console.error('Error fetching playstations:', error);
    res.status(500).json({ error: 'Failed to fetch playstations' });
  }
});

// Get single PlayStation
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const playstation = db.prepare('SELECT * FROM playstations WHERE id = ?').get(req.params.id);
    if (!playstation) {
      return res.status(404).json({ error: 'PlayStation not found' });
    }
    res.json(playstation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playstation' });
  }
});

// Create PlayStation (admin only)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    
    const result = db.prepare(`
      INSERT INTO playstations (name, description) VALUES (?, ?)
    `).run(name, description);

    logAudit(db, req.user.id, 'CREATE', 'playstation', result.lastInsertRowid, null, { name, description });

    res.json({ id: result.lastInsertRowid, name, description });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playstation' });
  }
});

// Update PlayStation (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, is_active } = req.body;
    const id = req.params.id;

    const old = db.prepare('SELECT * FROM playstations WHERE id = ?').get(id);
    if (!old) {
      return res.status(404).json({ error: 'PlayStation not found' });
    }

    db.prepare(`
      UPDATE playstations SET name = ?, description = ?, is_active = ? WHERE id = ?
    `).run(name, description, is_active !== undefined ? is_active : 1, id);

    logAudit(db, req.user.id, 'UPDATE', 'playstation', id, old, { name, description, is_active });

    res.json({ id: parseInt(id), name, description, is_active });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update playstation' });
  }
});

// Delete PlayStation (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;

    const old = db.prepare('SELECT * FROM playstations WHERE id = ?').get(id);
    if (!old) {
      return res.status(404).json({ error: 'PlayStation not found' });
    }

    db.prepare('UPDATE playstations SET is_active = 0 WHERE id = ?').run(id);
    logAudit(db, req.user.id, 'DELETE', 'playstation', id, old, null);

    res.json({ message: 'PlayStation deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playstation' });
  }
});

export default router;
