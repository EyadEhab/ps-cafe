import Database from 'better-sqlite3';
import { config } from './config.js';
import bcrypt from 'bcryptjs';

let db;

export function getDb() {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDatabase() {
  const database = getDb();

  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'worker')),
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    )
  `);

  // PlayStations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS playstations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pricing configuration
  database.exec(`
    CREATE TABLE IF NOT EXISTS pricing_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playstation_id INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('single', 'multi')),
      day_start_time TEXT NOT NULL DEFAULT '08:00',
      day_end_time TEXT NOT NULL DEFAULT '20:00',
      weekday_rate REAL NOT NULL DEFAULT 10,
      weekend_rate REAL NOT NULL DEFAULT 15,
      day_multiplier REAL DEFAULT 1.0,
      night_multiplier REAL DEFAULT 1.5,
      weekend_days TEXT DEFAULT '5,6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playstation_id) REFERENCES playstations(id),
      UNIQUE(playstation_id, mode)
    )
  `);

  // Sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playstation_id INTEGER NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      mode TEXT DEFAULT 'single' CHECK(mode IN ('single', 'multi')),
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      total_hours REAL DEFAULT 0,
      game_cost REAL DEFAULT 0,
      product_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER NOT NULL,
      ended_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playstation_id) REFERENCES playstations(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (ended_by) REFERENCES users(id)
    )
  `);

  // Product categories
  database.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES product_categories(id)
    )
  `);

  // Order items table
  database.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      added_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    )
  `);

  // Audit log for tracking modifications
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create default admin user if not exists
  const adminExists = database.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    database.prepare(`
      INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)
    `).run('admin', hashedPassword, 'admin', 'Admin');
  }

  // Create default worker user if not exists
  const workerExists = database.prepare('SELECT id FROM users WHERE role = ?').get('worker');
  if (!workerExists) {
    const hashedPassword = bcrypt.hashSync('worker123', 10);
    database.prepare(`
      INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)
    `).run('worker', hashedPassword, 'worker', 'Worker');
  }

  // Add mode column to sessions if not exists (migration for existing databases)
  try {
    database.prepare('SELECT mode FROM sessions LIMIT 1').get();
  } catch (err) {
    // Column doesn't exist, add it
    database.exec(`
      ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'single' CHECK(mode IN ('single', 'multi'))
    `);
  }

  // Create default 8 PlayStations if not exist
  const psCount = database.prepare('SELECT COUNT(*) as count FROM playstations').get();
  if (psCount.count === 0) {
    for (let i = 1; i <= 8; i++) {
      database.prepare(`
        INSERT INTO playstations (name, description) VALUES (?, ?)
      `).run(`PlayStation ${i}`, `PS Station ${i}`);
    }
  }

  // Create default pricing for each PlayStation
  const pricingCount = database.prepare('SELECT COUNT(*) as count FROM pricing_config').get();
  if (pricingCount.count === 0) {
    for (let i = 1; i <= 8; i++) {
      // Single mode pricing
      database.prepare(`
        INSERT INTO pricing_config (playstation_id, mode, weekday_rate, weekend_rate, day_start_time, day_end_time)
        VALUES (?, 'single', ?, ?, '08:00', '20:00')
      `).run(i, 10 + i, 15 + i);
      
      // Multi mode pricing
      database.prepare(`
        INSERT INTO pricing_config (playstation_id, mode, weekday_rate, weekend_rate, day_start_time, day_end_time)
        VALUES (?, 'multi', ?, ?, '08:00', '20:00')
      `).run(i, 15 + i * 2, 20 + i * 2);
    }
  }

  // Create default product categories
  const categories = [
    { name: 'Drinks', description: 'Beverages' },
    { name: 'Snacks', description: 'Snacks and light food' },
    { name: 'Food', description: 'Meals and hot food' },
    { name: 'Extras', description: 'Additional services' }
  ];

  const existingCategories = database.prepare('SELECT COUNT(*) as count FROM product_categories').get();
  if (existingCategories.count === 0) {
    for (const cat of categories) {
      database.prepare(`
        INSERT INTO product_categories (name, description) VALUES (?, ?)
      `).run(cat.name, cat.description);
    }

    // Add default products
    const defaultProducts = [
      { category: 'Drinks', name: 'Water', price: 2 },
      { category: 'Drinks', name: 'Soda', price: 3 },
      { category: 'Drinks', name: 'Coffee', price: 5 },
      { category: 'Snacks', name: 'Chips', price: 4 },
      { category: 'Snacks', name: 'Chocolate', price: 5 },
      { category: 'Food', name: 'Sandwich', price: 15 },
      { category: 'Food', name: 'Pizza Slice', price: 12 },
      { category: 'Extras', name: 'Extra Controller', price: 5 },
      { category: 'Extras', name: 'Charging Cable', price: 10 }
    ];

    for (const prod of defaultProducts) {
      const catId = database.prepare('SELECT id FROM product_categories WHERE name = ?').get(prod.category).id;
      database.prepare(`
        INSERT INTO products (category_id, name, price) VALUES (?, ?, ?)
      `).run(catId, prod.name, prod.price);
    }
  }

  console.log('Database initialized successfully');
}
