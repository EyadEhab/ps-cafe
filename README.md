# PS Cafe Management System

A comprehensive management system for PlayStation cafes with flexible pricing, product sales, and multi-user support.

## Features

- **8 PlayStations Management** - Track and manage all PlayStation stations
- **Flexible Pricing System**:
  - Different rates per PlayStation
  - Day/Night time pricing with custom hours
  - Weekday/Weekend rates
  - Single Player / Multi Player modes
- **Two User Roles**:
  - **Admin**: Full access to dashboard, reports, pricing, products, and audit logs
  - **Worker**: Start/end sessions, add products to orders, manage active sessions
- **Product Sales**:
  - Categories and products management
  - Add items to customer orders during sessions
- **Order Management**:
  - Add/remove/edit order items
  - Full audit trail of all modifications visible to admin
- **Customer Tracking**:
  - Optional customer name and phone number
  - Session history
- **Reports & Analytics**:
  - Daily/weekly/monthly revenue
  - PlayStation performance
  - Top products
  - Session reports
- **Audit Log**:
  - Track all worker modifications
  - View before/after values for changes

## Quick Start

### Using Docker (Recommended)

1. **Clone or navigate to the project directory**

2. **Start with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application**:
   - Frontend: http://localhost
   - Backend API: http://localhost:3001

4. **Default credentials**:
   - **Admin**: username: `admin`, password: `admin123`
   - **Worker**: username: `worker`, password: `worker123`

### Manual Setup

#### Backend

```bash
cd backend
npm install
npm start
```

Backend runs on http://localhost:3001

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000

## Default Configuration

### PlayStations
- 8 PlayStations pre-configured (PlayStation 1-8)

### Pricing (Default)
- **Single Mode**: $10-18/hour (varies by PS)
- **Multi Mode**: $15-26/hour (varies by PS)
- **Day Time**: 08:00 - 20:00 (1.0x multiplier)
- **Night Time**: 20:00 - 08:00 (1.5x multiplier)
- **Weekend**: Saturday & Sunday

### Products
- **Drinks**: Water ($2), Soda ($3), Coffee ($5)
- **Snacks**: Chips ($4), Chocolate ($5)
- **Food**: Sandwich ($15), Pizza Slice ($12)
- **Extras**: Extra Controller ($5), Charging Cable ($10)

## Usage Guide

### Worker Workflow

1. **Start a Session**:
   - Go to "Worker View"
   - Click "Start Session" on an available PlayStation
   - Enter customer name/phone (optional)
   - Add any notes

2. **Add Products**:
   - During the session, click "+ Add Item"
   - Select product and quantity
   - Item is added to the order

3. **End Session**:
   - Click "End Session"
   - Review total (game time + products)
   - Select pricing mode (Single/Multi)
   - Confirm and collect payment

### Admin Features

1. **Dashboard**: View real-time stats and revenue
2. **Pricing**: Configure rates for each PlayStation
3. **Products**: Manage categories and products
4. **Reports**: Detailed session and revenue reports
5. **Audit Log**: Track all worker modifications

## Data Persistence

Data is stored in a SQLite database (`ps-cafe.db`) persisted in a Docker volume. The database location is `/app/data/ps-cafe.db` inside the container.

## Environment Variables

### Backend
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Backend server port |
| JWT_SECRET | ps-cafe-secret... | JWT signing secret |
| DB_PATH | /app/data/ps-cafe.db | SQLite database path |

## API Endpoints

- `POST /api/auth/login` - User login
- `GET /api/playstations` - List all PlayStations
- `GET /api/sessions` - List sessions
- `POST /api/sessions/start` - Start a session
- `POST /api/sessions/:id/end` - End a session
- `GET /api/products` - List products
- `POST /api/orders/add-item` - Add item to order
- `GET /api/pricing` - Get pricing configuration
- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/audit` - Audit log (admin only)

## Security Notes

- Change the default passwords in production
- Update `JWT_SECRET` to a secure random value
- Use HTTPS in production
- Consider adding rate limiting for production use

## Troubleshooting

### Port already in use
If port 80 or 3001 is already in use, modify the `docker-compose.yml` ports section.

### Database reset
To reset the database, remove the Docker volume:
```bash
docker-compose down -v
docker-compose up -d --build
```
