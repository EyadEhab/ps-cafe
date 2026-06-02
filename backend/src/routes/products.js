import express from 'express';
import { getDb } from '../config/database.js';
import { authenticateToken, requireRole, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Get all product categories
router.get('/categories', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM product_categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (admin only)
router.post('/categories', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;

    const result = db.prepare(`
      INSERT INTO product_categories (name, description) VALUES (?, ?)
    `).run(name, description);

    logAudit(db, req.user.id, 'CREATE', 'product_category', result.lastInsertRowid, null, { name, description });

    res.json({ id: result.lastInsertRowid, name, description });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category (admin only)
router.put('/categories/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, is_active } = req.body;
    const id = req.params.id;

    const old = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(id);
    if (!old) {
      return res.status(404).json({ error: 'Category not found' });
    }

    db.prepare(`
      UPDATE product_categories SET name = ?, description = ?, is_active = ? WHERE id = ?
    `).run(name, description, is_active !== undefined ? is_active : 1, id);

    logAudit(db, req.user.id, 'UPDATE', 'product_category', id, old, { name, description, is_active });

    res.json({ id: parseInt(id), name, description, is_active });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category (admin only) - only if empty
router.delete('/categories/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;

    const category = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has products
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id).count;
    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with products. Please remove all products first.' });
    }

    logAudit(db, req.user.id, 'DELETE', 'product_category', id, category, null);

    db.prepare('DELETE FROM product_categories WHERE id = ?').run(id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Get all products
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { category_id, active_only } = req.query;
    
    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      JOIN product_categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(parseInt(category_id));
    }
    if (active_only === 'true') {
      query += ' AND p.is_active = 1';
    }

    query += ' ORDER BY c.name, p.name';

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product (admin only)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { category_id, name, description, price, cost, stock_quantity } = req.body;

    const result = db.prepare(`
      INSERT INTO products (category_id, name, description, price, cost, stock_quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(category_id, name, description || null, price, cost || 0, stock_quantity || 0);

    logAudit(db, req.user.id, 'CREATE', 'product', result.lastInsertRowid, null, req.body);

    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { category_id, name, description, price, cost, stock_quantity, is_active } = req.body;
    const id = req.params.id;

    const old = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!old) {
      return res.status(404).json({ error: 'Product not found' });
    }

    db.prepare(`
      UPDATE products 
      SET category_id = ?, name = ?, description = ?, price = ?, cost = ?, stock_quantity = ?, is_active = ?
      WHERE id = ?
    `).run(category_id, name, description, price, cost, stock_quantity, is_active !== undefined ? is_active : 1, id);

    logAudit(db, req.user.id, 'UPDATE', 'product', id, old, req.body);

    res.json({ id: parseInt(id), ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete/deactivate product (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;

    const old = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!old) {
      return res.status(404).json({ error: 'Product not found' });
    }

    db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
    logAudit(db, req.user.id, 'DELETE', 'product', id, old, null);

    res.json({ message: 'Product deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
