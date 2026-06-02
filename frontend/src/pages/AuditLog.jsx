import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { auditApi } from '../utils/api.js';

function AuditLog() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    try {
      const params = filter ? { entity_type: filter } : {};
      const { data } = await auditApi.getAll(params);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action) => {
    const colors = {
      CREATE: 'success',
      UPDATE: 'warning',
      DELETE: 'danger',
      START_SESSION: 'info',
      END_SESSION: 'success',
      ADD_ORDER_ITEM: 'success',
      REMOVE_ORDER_ITEM: 'danger',
      UPDATE_ORDER_ITEM: 'warning'
    };
    return <span className={`badge badge-${colors[action] || 'default'}`}>{action}</span>;
  };

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
        <h1>Audit Log</h1>
        <p className="help-text">
          Track all changes made by workers and admins. This includes order modifications, 
          session management, and configuration changes.
        </p>

        <div className="filter-buttons">
          <button 
            className={`btn ${filter === '' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('')}
          >
            All
          </button>
          <button 
            className={`btn ${filter === 'order_item' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('order_item')}
          >
            Order Changes
          </button>
          <button 
            className={`btn ${filter === 'session' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('session')}
          >
            Sessions
          </button>
          <button 
            className={`btn ${filter === 'product' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('product')}
          >
            Products
          </button>
          <button 
            className={`btn ${filter === 'pricing_config' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('pricing_config')}
          >
            Pricing
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Role</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.user_name || log.username}</td>
                <td><span className="badge">{log.user_role}</span></td>
                <td>{getActionBadge(log.action)}</td>
                <td>{log.entity_type}</td>
                <td>{log.entity_id || '-'}</td>
                <td className="audit-details">
                  {log.old_values && log.new_values && (
                    <details>
                      <summary>View Changes</summary>
                      <div className="change-details">
                        <div className="old-values">
                          <strong>Before:</strong>
                          <pre>{JSON.stringify(JSON.parse(log.old_values), null, 2)}</pre>
                        </div>
                        <div className="new-values">
                          <strong>After:</strong>
                          <pre>{JSON.stringify(JSON.parse(log.new_values), null, 2)}</pre>
                        </div>
                      </div>
                    </details>
                  )}
                  {!log.old_values && !log.new_values && '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

export default AuditLog;
