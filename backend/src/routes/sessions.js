import express from 'express';
import { getDb } from '../config/database.js';
import { authenticateToken, logAudit, requireRole } from '../middleware/auth.js';
import { calculateSessionCost } from '../utils/pricing.js';

const router = express.Router();

// Helper function to sanitize string inputs
function sanitizeString(str, maxLength = 100) {
  if (!str || typeof str !== 'string') return null;
  return str.trim().slice(0, maxLength);
}

// Helper function to validate phone number format
function validatePhone(phone) {
  if (!phone) return true; // Phone is optional
  // Allow digits, +, -, (), and spaces
  const phoneRegex = /^[\d\s\-\+\(\)]{8,20}$/;
  return phoneRegex.test(phone.trim());
}

// Get all sessions
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status, playstation_id, start_date, end_date, limit = 100 } = req.query;

    // Validate and sanitize query parameters
    const validatedLimit = Math.min(parseInt(limit) || 100, 1000); // Max 1000 records
    
    let query = `
      SELECT s.*, p.name as playstation_name, u.name as created_by_name, u2.name as ended_by_name
      FROM sessions s
      JOIN playstations p ON s.playstation_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN users u2 ON s.ended_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (status && ['active', 'completed', 'cancelled'].includes(status)) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (playstation_id && /^\d+$/.test(playstation_id)) {
      query += ' AND s.playstation_id = ?';
      params.push(parseInt(playstation_id));
    }
    if (start_date && /^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      query += ' AND date(s.start_time) >= ?';
      params.push(start_date);
    }
    if (end_date && /^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      query += ' AND date(s.start_time) <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY s.created_at DESC LIMIT ?';
    params.push(validatedLimit);

    const sessions = db.prepare(query).all(...params);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get active session for a PlayStation
router.get('/active/:playstationId', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const session = db.prepare(`
      SELECT s.*, p.name as playstation_name
      FROM sessions s
      JOIN playstations p ON s.playstation_id = p.id
      WHERE s.playstation_id = ? AND s.status = 'active'
    `).get(req.params.playstationId);
    
    res.json(session || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

// Start a new session
router.post('/start', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { playstation_id, customer_name, customer_phone, notes, mode } = req.body;

    // Validate playstation_id
    if (!playstation_id || !Number.isInteger(playstation_id) || playstation_id < 1) {
      return res.status(400).json({ error: 'Valid PlayStation ID required' });
    }

    // Validate mode
    const validModes = ['single', 'multi'];
    const validatedMode = mode && validModes.includes(mode) ? mode : 'single';

    // Sanitize and validate customer inputs
    const sanitizedCustomerName = customer_name ? sanitizeString(customer_name, 100) : null;
    
    if (customer_phone && !validatePhone(customer_phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    const sanitizedCustomerPhone = customer_phone ? sanitizeString(customer_phone, 20) : null;
    
    const sanitizedNotes = notes ? sanitizeString(notes, 500) : null;

    // Check if PlayStation already has active session
    const existing = db.prepare(`
      SELECT id FROM sessions WHERE playstation_id = ? AND status = 'active'
    `).get(playstation_id);

    if (existing) {
      return res.status(400).json({ error: 'PlayStation already has an active session' });
    }

    // Use Cairo timezone (UTC+2)
    const now = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' });
    // Convert to ISO format for SQLite
    const localTime = new Date(now).toISOString().slice(0, 19).replace('T', ' ');

    const result = db.prepare(`
      INSERT INTO sessions (playstation_id, customer_name, customer_phone, start_time, status, created_by, notes, mode)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(playstation_id, sanitizedCustomerName, sanitizedCustomerPhone, localTime, req.user.id, sanitizedNotes, validatedMode);

    logAudit(db, req.user.id, 'START_SESSION', 'session', result.lastInsertRowid, null, {
      playstation_id, customer_name, customer_phone, mode
    });

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
    res.json(session);
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End a session
router.post('/:id/end', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const sessionId = req.params.id;

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Use Cairo timezone (UTC+2) for consistent time handling
    const now = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' });
    const localTime = new Date(now).toISOString().slice(0, 19).replace('T', ' ');

    // Calculate costs using the session's stored mode
    // Both start_time and end_time must be in the same format (Cairo local time)
    const pricing = db.prepare(`
      SELECT * FROM pricing_config WHERE playstation_id = ? AND mode = ?
    `).get(session.playstation_id, session.mode || 'single');

    if (!pricing) {
      return res.status(400).json({ 
        error: 'Pricing configuration not found for this PlayStation mode. Please configure pricing first.' 
      });
    }

    const costData = calculateSessionCost(session.start_time, now, pricing);

    // Get order items total
    const orderItems = db.prepare(`
      SELECT SUM(subtotal) as total FROM order_items WHERE session_id = ?
    `).get(sessionId);
    const productCost = orderItems.total || 0;

    const totalCost = costData.gameCost + productCost;

    // Update session
    db.prepare(`
      UPDATE sessions
      SET end_time = ?,
          status = 'completed',
          ended_by = ?,
          total_hours = ?,
          game_cost = ?,
          product_cost = ?,
          total_cost = ?
      WHERE id = ?
    `).run(localTime, req.user.id, costData.totalHours, costData.gameCost, productCost, totalCost, sessionId);

    logAudit(db, req.user.id, 'END_SESSION', 'session', sessionId,
      { status: 'active' },
      { status: 'completed', total_hours: costData.totalHours, total_cost: totalCost }
    );

    const updatedSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    res.json(updatedSession);
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get session details with order items
router.get('/:id/details', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const sessionId = req.params.id;

    const session = db.prepare(`
      SELECT s.*, p.name as playstation_name, u.name as created_by_name, u2.name as ended_by_name
      FROM sessions s
      JOIN playstations p ON s.playstation_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN users u2 ON s.ended_by = u2.id
      WHERE s.id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const orderItems = db.prepare(`
      SELECT oi.*, pr.name as product_name, pr.stock_quantity
      FROM order_items oi
      LEFT JOIN products pr ON oi.product_id = pr.id
      WHERE oi.session_id = ?
    `).all(sessionId);

    res.json({ session, orderItems });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
});

// Delete session (admin or worker, within 24 hours of end time)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const sessionId = req.params.id;

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user has permission
    if (req.user.role !== 'admin') {
      // Workers can only delete within 24 hours of end time
      if (!session.end_time) {
        return res.status(403).json({ error: 'Cannot delete active sessions' });
      }
      const endTime = new Date(session.end_time);
      const now = new Date();
      const hoursDiff = (now - endTime) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        return res.status(403).json({ error: 'Can only delete sessions within 24 hours of end time' });
      }
    }

    // Delete all order items first
    db.prepare('DELETE FROM order_items WHERE session_id = ?').run(sessionId);

    // Delete the session
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    logAudit(db, req.user.id, 'DELETE', 'session', sessionId, session, null);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
