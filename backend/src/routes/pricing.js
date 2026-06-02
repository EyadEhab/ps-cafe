import express from 'express';
import { getDb } from '../config/database.js';
import { authenticateToken, requireRole, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Get pricing for all PlayStations
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const pricing = db.prepare(`
      SELECT pc.*, p.name as playstation_name
      FROM pricing_config pc
      JOIN playstations p ON pc.playstation_id = p.id
      ORDER BY pc.playstation_id, pc.mode
    `).all();
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// Get pricing for specific PlayStation
router.get('/:playstationId', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const pricing = db.prepare(`
      SELECT * FROM pricing_config WHERE playstation_id = ?
    `).all(req.params.playstationId);
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// Update pricing (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const {
      day_start_time,
      day_end_time,
      weekday_rate,
      weekend_rate,
      day_multiplier,
      night_multiplier,
      weekend_days
    } = req.body;

    const old = db.prepare('SELECT * FROM pricing_config WHERE id = ?').get(id);
    if (!old) {
      return res.status(404).json({ error: 'Pricing configuration not found' });
    }

    db.prepare(`
      UPDATE pricing_config SET
        day_start_time = ?,
        day_end_time = ?,
        weekday_rate = ?,
        weekend_rate = ?,
        day_multiplier = ?,
        night_multiplier = ?,
        weekend_days = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      day_start_time || old.day_start_time,
      day_end_time || old.day_end_time,
      weekday_rate !== undefined ? weekday_rate : old.weekday_rate,
      weekend_rate !== undefined ? weekend_rate : old.weekend_rate,
      day_multiplier !== undefined ? day_multiplier : old.day_multiplier,
      night_multiplier !== undefined ? night_multiplier : old.night_multiplier,
      weekend_days || old.weekend_days,
      id
    );

    logAudit(db, req.user.id, 'UPDATE', 'pricing_config', id, old, req.body);

    const updated = db.prepare('SELECT * FROM pricing_config WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

export default router;
