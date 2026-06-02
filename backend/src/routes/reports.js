import express from 'express';
import { getDb } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard stats
router.get('/dashboard', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    // Today's stats
    const today = new Date().toISOString().split('T')[0];

    const todayStats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'completed' THEN total_cost ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' THEN product_cost ELSE 0 END) as product_revenue,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
        SUM(CASE WHEN status = 'completed' THEN total_hours ELSE 0 END) as total_hours
      FROM sessions
      WHERE date(start_time) = ?
    `).get(today);

    // This week's stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekStats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'completed' THEN total_cost ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' THEN product_cost ELSE 0 END) as product_revenue,
        SUM(CASE WHEN status = 'completed' THEN total_hours ELSE 0 END) as total_hours
      FROM sessions
      WHERE start_time >= ?
    `).get(weekAgo.toISOString());

    // This month's stats
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const monthStats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'completed' THEN total_cost ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' THEN product_cost ELSE 0 END) as product_revenue,
        SUM(CASE WHEN status = 'completed' THEN total_hours ELSE 0 END) as total_hours
      FROM sessions
      WHERE start_time >= ?
    `).get(monthAgo.toISOString());

    // Revenue by PlayStation (this week)
    const revenueByPS = db.prepare(`
      SELECT 
        p.name as playstation_name,
        COUNT(s.id) as session_count,
        SUM(s.total_cost) as total_revenue,
        SUM(s.total_hours) as total_hours
      FROM sessions s
      JOIN playstations p ON s.playstation_id = p.id
      WHERE s.start_time >= ? AND s.status = 'completed'
      GROUP BY s.playstation_id
      ORDER BY total_revenue DESC
    `).all(weekAgo.toISOString());

    // Top products (this week)
    const topProducts = db.prepare(`
      SELECT 
        p.name as product_name,
        SUM(oi.quantity) as total_sold,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN sessions s ON oi.session_id = s.id
      WHERE s.start_time >= ?
      GROUP BY oi.product_id
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all(weekAgo.toISOString());

    res.json({
      today: todayStats,
      week: weekStats,
      month: monthStats,
      revenueByPS,
      topProducts
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get detailed reports
router.get('/sessions', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { start_date, end_date, playstation_id } = req.query;

    let query = `
      SELECT 
        s.*,
        p.name as playstation_name,
        u.name as created_by_name,
        u2.name as ended_by_name
      FROM sessions s
      JOIN playstations p ON s.playstation_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN users u2 ON s.ended_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND date(s.start_time) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date(s.start_time) <= ?';
      params.push(end_date);
    }
    if (playstation_id) {
      query += ' AND s.playstation_id = ?';
      params.push(parseInt(playstation_id));
    }

    query += ' ORDER BY s.start_time DESC';

    const sessions = db.prepare(query).all(...params);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session report' });
  }
});

// Get revenue report
router.get('/revenue', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { start_date, end_date, group_by = 'day' } = req.query;

    let dateFormat = '%Y-%m-%d'; // day
    if (group_by === 'week') dateFormat = '%Y-W%W';
    if (group_by === 'month') dateFormat = '%Y-%m';

    const query = `
      SELECT 
        strftime(?, start_time) as period,
        COUNT(*) as session_count,
        SUM(total_cost) as total_revenue,
        SUM(game_cost) as game_revenue,
        SUM(product_cost) as product_revenue,
        SUM(total_hours) as total_hours,
        AVG(total_cost) as avg_session_value
      FROM sessions
      WHERE status = 'completed'
        AND (? IS NULL OR date(start_time) >= ?)
        AND (? IS NULL OR date(start_time) <= ?)
      GROUP BY period
      ORDER BY period DESC
    `;

    const revenue = db.prepare(query).all(
      dateFormat,
      start_date || null, start_date || null,
      end_date || null, end_date || null
    );

    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue report' });
  }
});

export default router;
