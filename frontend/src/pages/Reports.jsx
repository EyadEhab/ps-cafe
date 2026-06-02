import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { reportApi } from '../utils/api.js';

function Reports() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sessions');
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    playstation_id: ''
  });

  useEffect(() => {
    loadReports();
  }, [activeTab, filters]);

  const loadReports = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sessions') {
        const { data } = await reportApi.getSessions(filters);
        setSessions(data);
      } else {
        const { data } = await reportApi.getRevenue({ ...filters, group_by: 'day' });
        setRevenue(data);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const totals = sessions.reduce((acc, s) => ({
    sessions: acc.sessions + 1,
    hours: acc.hours + (s.total_hours || 0),
    game: acc.game + (s.game_cost || 0),
    products: acc.products + (s.product_cost || 0),
    total: acc.total + (s.total_cost || 0)
  }), { sessions: 0, hours: 0, game: 0, products: 0, total: 0 });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">🎮 PS Cafe</div>
        <div className="navbar-menu">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Dashboard</Link>
          <Link to="/playstations" className={location.pathname === '/playstations' ? 'active' : ''}>PlayStations</Link>
          <Link to="/users" className={location.pathname === '/users' ? 'active' : ''}>Users</Link>
          <Link to="/products" className={location.pathname === '/products' ? 'active' : ''}>Products</Link>
          <Link to="/pricing" className={location.pathname === '/pricing' ? 'active' : ''}>Pricing</Link>
          <Link to="/orders" className={location.pathname === '/orders' ? 'active' : ''}>Orders</Link>
          {user?.role === 'admin' && (
            <>
              <Link to="/reports" className={location.pathname === '/reports' ? 'active' : ''}>Reports</Link>
              <Link to="/audit" className={location.pathname === '/audit' ? 'active' : ''}>Audit Log</Link>
            </>
          )}
        </div>
        <div className="navbar-user">
          <span>{user?.name} ({user?.role})</span>
          <button onClick={() => logout()} className="btn btn-secondary">Logout</button>
        </div>
      </nav>

      <main className="main-content">
        <h1>Reports</h1>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions Report
          </button>
          <button 
            className={`tab ${activeTab === 'revenue' ? 'active' : ''}`}
            onClick={() => setActiveTab('revenue')}
          >
            Revenue Report
          </button>
        </div>

        <div className="filters">
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              name="start_date"
              value={filters.start_date}
              onChange={handleFilterChange}
            />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              name="end_date"
              value={filters.end_date}
              onChange={handleFilterChange}
            />
          </div>
          <div className="form-group">
            <label>PlayStation</label>
            <select name="playstation_id" value={filters.playstation_id} onChange={handleFilterChange}>
              <option value="">All</option>
              {[1,2,3,4,5,6,7,8].map(id => (
                <option key={id} value={id}>PlayStation {id}</option>
              ))}
            </select>
          </div>
        </div>

        {activeTab === 'sessions' && (
          <>
            <div className="totals-bar">
              <div className="total-item">
                <span>Sessions:</span>
                <strong>{totals.sessions}</strong>
              </div>
              <div className="total-item">
                <span>Hours:</span>
                <strong>{totals.hours.toFixed(1)}</strong>
              </div>
              <div className="total-item">
                <span>Game Revenue:</span>
                <strong>${totals.game.toFixed(2)}</strong>
              </div>
              <div className="total-item">
                <span>Product Revenue:</span>
                <strong>${totals.products.toFixed(2)}</strong>
              </div>
              <div className="total-item highlight">
                <span>Total:</span>
                <strong>${totals.total.toFixed(2)}</strong>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>PlayStation</th>
                  <th>Customer</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Hours</th>
                  <th>Game</th>
                  <th>Products</th>
                  <th>Total</th>
                  <th>Worker</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>#{session.id}</td>
                    <td>{session.playstation_name}</td>
                    <td>{session.customer_name || 'Walk-in'}</td>
                    <td>{new Date(session.start_time).toLocaleDateString()}</td>
                    <td>{session.end_time ? new Date(session.end_time).toLocaleDateString() : '-'}</td>
                    <td>{session.total_hours?.toFixed(2) || '-'}</td>
                    <td>${session.game_cost?.toFixed(2) || '0.00'}</td>
                    <td>${session.product_cost?.toFixed(2) || '0.00'}</td>
                    <td className="total-cell">${session.total_cost?.toFixed(2) || '0.00'}</td>
                    <td>{session.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {activeTab === 'revenue' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Sessions</th>
                <th>Hours</th>
                <th>Game Revenue</th>
                <th>Product Revenue</th>
                <th>Total Revenue</th>
                <th>Avg Session</th>
              </tr>
            </thead>
            <tbody>
              {revenue.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{row.session_count}</td>
                  <td>{row.total_hours?.toFixed(1)}</td>
                  <td>${(row.total_revenue - (row.product_revenue || 0)).toFixed(2)}</td>
                  <td>${row.product_revenue?.toFixed(2) || '0.00'}</td>
                  <td className="total-cell">${row.total_revenue?.toFixed(2) || '0.00'}</td>
                  <td>${row.avg_session_value?.toFixed(2) || '0.00'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}

export default Reports;
