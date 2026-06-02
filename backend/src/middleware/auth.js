import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function logAudit(db, userId, action, entityType, entityId, oldValues = null, newValues = null) {
  db.prepare(`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    action,
    entityType,
    entityId,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null
  );
}
