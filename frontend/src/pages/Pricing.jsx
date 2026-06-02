import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { pricingApi, playstationApi } from '../utils/api.js';

function Pricing() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [pricing, setPricing] = useState([]);
  const [playstations, setPlaystations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pricingRes, psRes] = await Promise.all([
        pricingApi.getAll(),
        playstationApi.getAll()
      ]);
      setPricing(pricingRes.data);
      setPlaystations(psRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config) => {
    setEditingId(config.id);
    setFormData({
      day_start_time: config.day_start_time,
      day_end_time: config.day_end_time,
      weekday_rate: config.weekday_rate,
      weekend_rate: config.weekend_rate,
      day_multiplier: config.day_multiplier,
      night_multiplier: config.night_multiplier,
      weekend_days: config.weekend_days
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
  };

  const handleSave = async (id) => {
    try {
      await pricingApi.update(id, formData);
      setEditingId(null);
      loadData();
    } catch (error) {
      alert('Failed to update: ' + (error.response?.data?.error || error.message));
    }
  };

  const getPlayStationName = (id) => {
    return playstations.find(ps => ps.id === id)?.name || `PS ${id}`;
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
        <h1>Pricing Configuration</h1>
        <p className="help-text">
          Configure pricing for each PlayStation. Day time rates are multiplied by the day multiplier, 
          night time rates by the night multiplier. Weekend rates apply on selected days.
        </p>

        <div className="pricing-grid">
          {pricing.map((config) => (
            <div key={config.id} className="pricing-card">
              <div className="pricing-header">
                <h3>{getPlayStationName(config.playstation_id)}</h3>
                <span className={`mode-badge ${config.mode}`}>
                  {config.mode === 'single' ? '👤 Single' : '👥 Multi'}
                </span>
              </div>

              {editingId === config.id ? (
                <div className="pricing-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Day Start</label>
                      <input
                        type="time"
                        value={formData.day_start_time}
                        onChange={(e) => setFormData({ ...formData, day_start_time: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Day End</label>
                      <input
                        type="time"
                        value={formData.day_end_time}
                        onChange={(e) => setFormData({ ...formData, day_end_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Weekday Rate ($/hr)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.weekday_rate}
                        onChange={(e) => setFormData({ ...formData, weekday_rate: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Weekend Rate ($/hr)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.weekend_rate}
                        onChange={(e) => setFormData({ ...formData, weekend_rate: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Day Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.day_multiplier}
                        onChange={(e) => setFormData({ ...formData, day_multiplier: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Night Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.night_multiplier}
                        onChange={(e) => setFormData({ ...formData, night_multiplier: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Weekend Days</label>
                    <select
                      value={formData.weekend_days}
                      onChange={(e) => setFormData({ ...formData, weekend_days: e.target.value })}
                    >
                      <option value="5,6">Saturday & Sunday (US)</option>
                      <option value="4,5">Friday & Saturday (Middle East)</option>
                      <option value="6">Sunday only</option>
                      <option value="0,6">Weekend (Sun & Sat)</option>
                    </select>
                  </div>

                  <div className="modal-actions">
                    <button onClick={handleCancel} className="btn btn-secondary">Cancel</button>
                    <button onClick={() => handleSave(config.id)} className="btn btn-success">Save</button>
                  </div>
                </div>
              ) : (
                <div className="pricing-body">
                  <div className="pricing-row">
                    <span>Day Time:</span>
                    <span>{config.day_start_time} - {config.day_end_time}</span>
                  </div>
                  <div className="pricing-row">
                    <span>Weekday Rate:</span>
                    <span>${config.weekday_rate.toFixed(2)}/hr</span>
                  </div>
                  <div className="pricing-row">
                    <span>Weekend Rate:</span>
                    <span>${config.weekend_rate.toFixed(2)}/hr</span>
                  </div>
                  <div className="pricing-row">
                    <span>Day Multiplier:</span>
                    <span>x{config.day_multiplier}</span>
                  </div>
                  <div className="pricing-row">
                    <span>Night Multiplier:</span>
                    <span>x{config.night_multiplier}</span>
                  </div>
                  <div className="pricing-row">
                    <span>Weekend Days:</span>
                    <span>{config.weekend_days === '5,6' ? 'Sat, Sun' : config.weekend_days}</span>
                  </div>
                  <div className="pricing-row effective-rate">
                    <span>Effective Day Rate:</span>
                    <span>${(config.weekday_rate * config.day_multiplier).toFixed(2)}/hr</span>
                  </div>
                  <div className="pricing-row effective-rate">
                    <span>Effective Night Rate:</span>
                    <span>${(config.weekday_rate * config.night_multiplier).toFixed(2)}/hr</span>
                  </div>

                  {user?.role === 'admin' && (
                    <button onClick={() => handleEdit(config)} className="btn btn-primary btn-block">
                      Edit Pricing
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Pricing;
