import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';
import { initDatabase } from './config/database.js';
import { securityHeaders, apiLimiter, corsOptions } from './middleware/security.js';
import authRoutes from './routes/auth.js';
import playstationRoutes from './routes/playstations.js';
import sessionRoutes from './routes/sessions.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import pricingRoutes from './routes/pricing.js';
import reportRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';
import userRoutes from './routes/users.js';

const app = express();

// Initialize database
initDatabase();

// Security middleware - MUST be first
app.use(securityHeaders());

// CORS configuration - MUST be before other middleware
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' })); // Limit body size to prevent DoS

// Rate limiting for all API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/playstations', playstationRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Secure error handler - don't expose internals in production
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't expose stack traces in production
  if (config.nodeEnv === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ 
      error: 'Something went wrong!',
      message: err.message,
      stack: err.stack 
    });
  }
});

app.listen(config.port, () => {
  console.log(`PS Cafe Backend running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  if (config.nodeEnv === 'production') {
    console.log('WARNING: Ensure JWT_SECRET is set to a secure random value!');
  }
});
