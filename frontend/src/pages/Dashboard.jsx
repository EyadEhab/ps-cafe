import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { reportApi } from '../utils/api.js';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data } = await reportApi.getDashboard();
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">🎮 PS Cafe</div>
        <div className="navbar-menu">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Dashboard</Link>
          {user?.role === 'admin' && (
            <>
              <Link to="/playstations" className={location.pathname === '/playstations' ? 'active' : ''}>PlayStations</Link>
              <Link to="/users" className={location.pathname === '/users' ? 'active' : ''}>Users</Link>
              <Link to="/products" className={location.pathname === '/products' ? 'active' : ''}>Products</Link>
              <Link to="/pricing" className={location.pathname === '/pricing' ? 'active' : ''}>Pricing</Link>
              <Link to="/reports" className={location.pathname === '/reports' ? 'active' : ''}>Reports</Link>
              <Link to="/audit" className={location.pathname === '/audit' ? 'active' : ''}>Audit Log</Link>
            </>
          )}
          <Link to="/orders" className={location.pathname === '/orders' ? 'active' : ''}>Orders</Link>
        </div>
        <div className="navbar-user">
          <span>{user?.name} ({user?.role})</span>
          <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
        </div>
      </nav>

      <main className="main-content">
        <h1>Dashboard</h1>
        
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Today</h3>
            <div className="stat-value">{stats?.today?.total_sessions || 0}</div>
            <div className="stat-label">Sessions</div>
            <div className="stat-sub">${stats?.today?.total_revenue?.toFixed(2) || '0.00'}</div>
            <div className="stat-breakdown">
              <span>Game: ${(stats?.today?.total_revenue - stats?.today?.product_revenue || 0).toFixed(2)}</span>
              <span>Products: ${stats?.today?.product_revenue?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          <div className="stat-card">
            <h3>This Week</h3>
            <div className="stat-value">{stats?.week?.total_sessions || 0}</div>
            <div className="stat-label">Sessions</div>
            <div className="stat-sub">${stats?.week?.total_revenue?.toFixed(2) || '0.00'}</div>
            <div className="stat-breakdown">
              <span>Game: ${(stats?.week?.total_revenue - stats?.week?.product_revenue || 0).toFixed(2)}</span>
              <span>Products: ${stats?.week?.product_revenue?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          <div className="stat-card">
            <h3>This Month</h3>
            <div className="stat-value">{stats?.month?.total_sessions || 0}</div>
            <div className="stat-label">Sessions</div>
            <div className="stat-sub">${stats?.month?.total_revenue?.toFixed(2) || '0.00'}</div>
            <div className="stat-breakdown">
              <span>Game: ${(stats?.month?.total_revenue - stats?.month?.product_revenue || 0).toFixed(2)}</span>
              <span>Products: ${stats?.month?.product_revenue?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          <div className="stat-card highlight">
            <h3>Active Now</h3>
            <div className="stat-value">{stats?.today?.active_sessions || 0}</div>
            <div className="stat-label">PlayStations in use</div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section">
            <h2>Revenue by PlayStation (This Week)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>PlayStation</th>
                  <th>Sessions</th>
                  <th>Hours</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats?.revenueByPS?.map((ps) => (
                  <tr key={ps.playstation_name}>
                    <td>{ps.playstation_name}</td>
                    <td>{ps.session_count}</td>
                    <td>{ps.total_hours?.toFixed(1)}</td>
                    <td>${ps.total_revenue?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dashboard-section">
            <h2>Top Products (This Week)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats?.topProducts?.map((product) => (
                  <tr key={product.product_name}>
                    <td>{product.product_name}</td>
                    <td>{product.total_sold}</td>
                    <td>${product.total_revenue?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
