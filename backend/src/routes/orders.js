import express from 'express';
import { getDb } from '../config/database.js';
import { authenticateToken, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Add item to order (admin can edit anytime, worker only within 24 hours)
router.post('/add-item', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { session_id, product_id, quantity } = req.body;

    // Validate inputs
    if (!session_id || !product_id || !quantity) {
      return res.status(400).json({ error: 'Session ID, product ID, and quantity required' });
    }

    // Validate types
    if (!Number.isInteger(session_id) || session_id < 1) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    if (!Number.isInteger(product_id) || product_id < 1) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
    }

    // Verify session exists
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if session is editable
    // Admins can edit anytime, workers can only edit active sessions or within 24 hours of end time
    if (req.user.role !== 'admin') {
      if (session.status === 'active' || !session.end_time) {
        // Active session - OK for workers
      } else {
        // Check if within 24 hours of end time
        const endTime = new Date(session.end_time);
        const now = new Date();
        const hoursDiff = (now - endTime) / (1000 * 60 * 60);
        if (hoursDiff > 24) {
          return res.status(400).json({ error: 'Workers can only add items to active sessions or within 24 hours of end time' });
        }
      }
    }
    // Admins can add items to any session (no time restriction)

    // Get product
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const unitPrice = product.price;
    const subtotal = unitPrice * quantity;

    const result = db.prepare(`
      INSERT INTO order_items (session_id, product_id, quantity, unit_price, subtotal, added_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session_id, product_id, quantity, unitPrice, subtotal, req.user.id);

    logAudit(db, req.user.id, 'ADD_ORDER_ITEM', 'order_item', result.lastInsertRowid, null, {
      session_id, product_id, quantity, unit_price: unitPrice, subtotal
    });

    const orderItem = db.prepare(`
      SELECT oi.*, p.name as product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.id = ?
    `).get(result.lastInsertRowid);

    // Update session product_cost and total_cost
    const orderTotal = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE session_id = ?
    `).get(session_id);
    
    db.prepare(`
      UPDATE sessions SET product_cost = ?, total_cost = game_cost + ? WHERE id = ?
    `).run(orderTotal.total, orderTotal.total, session_id);

    res.json(orderItem);
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item to order' });
  }
});

// Remove item from order (admin can edit anytime, worker only within 24 hours)
router.delete('/items/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const itemId = req.params.id;

    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    const sessionId = item.session_id;
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

    // Check permissions - Admins can remove anytime, workers only within 24 hours
    if (req.user.role !== 'admin') {
      if (session.status === 'active' || !session.end_time) {
        // Active session - OK for workers
      } else {
        const endTime = new Date(session.end_time);
        const now = new Date();
        const hoursDiff = (now - endTime) / (1000 * 60 * 60);
        if (hoursDiff > 24) {
          return res.status(400).json({ error: 'Workers can only remove items from active sessions or within 24 hours of end time' });
        }
      }
    }

    logAudit(db, req.user.id, 'REMOVE_ORDER_ITEM', 'order_item', itemId, item, null);

    db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);

    // Update session product_cost and total_cost
    const orderTotal = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE session_id = ?
    `).get(sessionId);

    db.prepare(`
      UPDATE sessions SET product_cost = ?, total_cost = game_cost + ? WHERE id = ?
    `).run(orderTotal.total, orderTotal.total, sessionId);

    res.json({ message: 'Item removed from order' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Update item quantity (admin can edit anytime, worker only within 24 hours)
router.put('/items/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const itemId = req.params.id;
    const { quantity } = req.body;

    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    const oldValues = { ...item };
    const sessionId = item.session_id;
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

    // Check permissions - Admins can update anytime, workers only within 24 hours
    if (req.user.role !== 'admin') {
      if (session.status === 'active' || !session.end_time) {
        // Active session - OK for workers
      } else {
        const endTime = new Date(session.end_time);
        const now = new Date();
        const hoursDiff = (now - endTime) / (1000 * 60 * 60);
        if (hoursDiff > 24) {
          return res.status(400).json({ error: 'Workers can only update items in active sessions or within 24 hours of end time' });
        }
      }
    }

    const subtotal = item.unit_price * quantity;

    db.prepare(`
      UPDATE order_items SET quantity = ?, subtotal = ? WHERE id = ?
    `).run(quantity, subtotal, itemId);

    logAudit(db, req.user.id, 'UPDATE_ORDER_ITEM', 'order_item', itemId, oldValues, { quantity, subtotal });

    // Update session product_cost and total_cost
    const orderTotal = db.prepare(`
      SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE session_id = ?
    `).get(sessionId);

    db.prepare(`
      UPDATE sessions SET product_cost = ?, total_cost = game_cost + ? WHERE id = ?
    `).run(orderTotal.total, orderTotal.total, sessionId);

    const updatedItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Get order items for a session
router.get('/session/:sessionId', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const sessionId = req.params.sessionId;

    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, c.name as category_name, u.name as added_by_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN product_categories c ON p.category_id = c.id
      JOIN users u ON oi.added_by = u.id
      WHERE oi.session_id = ?
      ORDER BY oi.created_at
    `).all(sessionId);

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order items' });
  }
});

export default router;
