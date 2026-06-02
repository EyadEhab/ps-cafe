import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables in production
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET;

if (isProduction && (!jwtSecret || jwtSecret === 'ps-cafe-secret-key-change-in-production')) {
  console.error('ERROR: JWT_SECRET must be set to a secure random value in production!');
  console.error('Generate one using: openssl rand -base64 32');
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 3001,
  jwtSecret: jwtSecret || 'ps-cafe-secret-key-change-in-production',
  dbPath: process.env.DB_PATH || '/app/data/ps-cafe.db',
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
  nodeEnv: process.env.NODE_ENV || 'development'
};
