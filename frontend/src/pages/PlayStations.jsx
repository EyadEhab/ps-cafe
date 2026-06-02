import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { playstationApi } from '../utils/api.js';

function PlayStations() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [playstations, setPlaystations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPS, setEditingPS] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(1);

  useEffect(() => {
    loadPlayStations();
  }, []);

  const loadPlayStations = async () => {
    try {
      const { data } = await playstationApi.getAll();
      setPlaystations(data);
    } catch (error) {
      console.error('Failed to load playstations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (ps = null) => {
    if (ps) {
      setEditingPS(ps);
      setName(ps.name);
      setDescription(ps.description || '');
      setIsActive(ps.is_active);
    } else {
      setEditingPS(null);
      setName('');
      setDescription('');
      setIsActive(1);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPS) {
        await playstationApi.update(editingPS.id, { name, description, is_active: isActive });
      } else {
        await playstationApi.create({ name, description });
      }
      setShowModal(false);
      loadPlayStations();
    } catch (error) {
      alert('Failed to save: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this PlayStation?')) return;
    try {
      await playstationApi.delete(id);
      loadPlayStations();
    } catch (error) {
      alert('Failed to delete: ' + (error.response?.data?.error || error.message));
    }
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
        <div className="page-header">
          <h1>PlayStation Management</h1>
          {user?.role === 'admin' && (
            <button onClick={() => handleOpenModal()} className="btn btn-primary">
              + Add PlayStation
            </button>
          )}
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Active Sessions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {playstations.map((ps) => (
              <tr key={ps.id}>
                <td>{ps.id}</td>
                <td>{ps.name}</td>
                <td>{ps.description || '-'}</td>
                <td>
                  <span className={`status-badge ${ps.is_active ? 'active' : 'inactive'}`}>
                    {ps.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{ps.active_sessions || 0}</td>
                <td>
                  {user?.role === 'admin' && (
                    <>
                      <button onClick={() => handleOpenModal(ps)} className="btn btn-sm btn-secondary">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(ps.id)} className="btn btn-sm btn-danger">
                        Deactivate
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPS ? 'Edit PlayStation' : 'Add PlayStation'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., PlayStation 1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows="3"
                />
              </div>
              {user?.role === 'admin' && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={isActive === 1}
                      onChange={(e) => setIsActive(e.target.checked ? 1 : 0)}
                    />
                    {' '}Active
                  </label>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPS ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayStations;
