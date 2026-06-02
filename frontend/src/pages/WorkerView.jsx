import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { playstationApi, sessionApi, orderApi, productApi } from '../utils/api.js';
import api from '../utils/api.js';

function WorkerView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [playstations, setPlaystations] = useState([]);
  const [sessions, setSessions] = useState({});
  const [orderItems, setOrderItems] = useState({});
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Use refs for values accessed in interval
  const sessionsRef = useRef({});
  const pricingRef = useRef({});
  
  // Modal states
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedPS, setSelectedPS] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState('single');
  const [elapsedTime, setElapsedTime] = useState({});
  const [currentCost, setCurrentCost] = useState({});
  const [pricing, setPricing] = useState({});

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    const timerInterval = setInterval(updateTimers, 1000); // Update timers every second
    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, []);

  const loadData = async () => {
    try {
      const [psRes, productsRes, categoriesRes, pricingRes] = await Promise.all([
        playstationApi.getAll(),
        productApi.getAll({ active_only: true }),
        productApi.getCategories(),
        api.get('/pricing')
      ]);

      setPlaystations(psRes.data);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      
      // Build pricing lookup by playstation_id and mode
      const pricingData = {};
      pricingRes.data.forEach(p => {
        if (!pricingData[p.playstation_id]) {
          pricingData[p.playstation_id] = {};
        }
        pricingData[p.playstation_id][p.mode] = p;
      });
      setPricing(pricingData);

      // Load active sessions for each PlayStation
      const sessionsData = {};
      const orderItemsData = {};
      
      for (const ps of psRes.data) {
        try {
          const sessionRes = await sessionApi.getActive(ps.id);
          if (sessionRes.data) {
            sessionsData[ps.id] = sessionRes.data;
            const itemsRes = await orderApi.getSessionItems(sessionRes.data.id);
            orderItemsData[sessionRes.data.id] = itemsRes.data;
          }
        } catch (err) {
          // No active session for this PS
        }
      }
      
      setSessions(sessionsData);
      setOrderItems(orderItemsData);
      
      // Update refs for interval
      sessionsRef.current = sessionsData;
      pricingRef.current = pricingData;
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentRate = (pricingConfig) => {
    if (!pricingConfig) return 0;
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeValue = hour + minute / 60;

    const [dayStartHour, dayStartMin] = (pricingConfig.day_start_time || '08:00').split(':').map(Number);
    const [dayEndHour, dayEndMin] = (pricingConfig.day_end_time || '20:00').split(':').map(Number);
    const dayStartValue = dayStartHour + dayStartMin / 60;
    const dayEndValue = dayEndHour + dayEndMin / 60;

    const weekendDays = (pricingConfig.weekend_days || '5,6').split(',').map(Number);
    const isDayTime = timeValue >= dayStartValue && timeValue < dayEndValue;
    const isWeekend = weekendDays.includes(dayOfWeek);

    let rate = isWeekend ? pricingConfig.weekend_rate : pricingConfig.weekday_rate;
    const multiplier = isDayTime ? pricingConfig.day_multiplier : pricingConfig.night_multiplier;
    
    return rate * multiplier;
  };

  const updateTimers = () => {
    const newElapsedTime = {};
    const newCurrentCost = {};

    Object.keys(sessionsRef.current).forEach(psId => {
      const session = sessionsRef.current[psId];
      if (session && session.start_time) {
        const start = new Date(session.start_time);
        const now = new Date();
        const diffMs = now - start;
        const hours = diffMs / (1000 * 60 * 60);

        newElapsedTime[psId] = hours;

        // Get pricing for this session - use the session mode
        const sessionMode = session.mode || 'single';
        const psPricing = pricingRef.current[psId]?.[sessionMode];
        if (psPricing) {
          const rate = getCurrentRate(psPricing);
          newCurrentCost[psId] = hours * rate;
        } else {
          newCurrentCost[psId] = 0;
        }
      }
    });

    setElapsedTime(newElapsedTime);
    setCurrentCost(newCurrentCost);
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    try {
      await sessionApi.start({
        playstation_id: selectedPS.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        notes,
        mode
      });
      setShowStartModal(false);
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setMode('single');
      loadData();
    } catch (error) {
      alert('Failed to start session: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEndSession = async () => {
    try {
      // The backend will calculate the final cost based on actual elapsed time
      await sessionApi.end(selectedSession.id);
      setShowEndModal(false);
      setSelectedSession(null);
      loadData();
    } catch (error) {
      alert('Failed to end session: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await orderApi.addItem({
        session_id: selectedSession.id,
        product_id: parseInt(selectedProduct),
        quantity: parseInt(quantity)
      });
      setShowAddItemModal(false);
      setSelectedProduct('');
      setQuantity(1);
      loadData();
    } catch (error) {
      alert('Failed to add item: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!confirm('Remove this item from the order?')) return;
    try {
      await orderApi.removeItem(itemId);
      loadData();
    } catch (error) {
      alert('Failed to remove item: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openStartModal = (ps) => {
    setSelectedPS(ps);
    setShowStartModal(true);
  };

  const openEndModal = (session) => {
    setSelectedSession(session);
    setShowEndModal(true);
  };

  const openAddItemModal = (session) => {
    setSelectedSession(session);
    setShowAddItemModal(true);
  };

  const getSessionTotal = (session, items) => {
    const gameCost = session.game_cost || 0;
    const productCost = items?.reduce((sum, item) => sum + item.subtotal, 0) || 0;
    return gameCost + productCost;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="worker-view">
      <nav className="navbar">
        <div className="navbar-brand">🎮 PS Cafe - Worker</div>
        <div className="navbar-menu">
          <Link to="/orders" className={location.pathname === '/orders' ? 'active' : ''}>Orders</Link>
        </div>
        <div className="navbar-user">
          <span>{user?.name}</span>
          <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
        </div>
      </nav>

      <main className="main-content">
        <h1>PlayStation Status</h1>
        
        <div className="ps-grid">
          {playstations.map((ps) => {
            const session = sessions[ps.id];
            const items = orderItems[session?.id] || [];
            const isActive = !!session;

            return (
              <div key={ps.id} className={`ps-card ${isActive ? 'active' : 'available'}`}>
                <div className="ps-card-header">
                  <h3>{ps.name}</h3>
                  <span className={`status-badge ${isActive ? 'active' : 'available'}`}>
                    {isActive ? 'In Use' : 'Available'}
                  </span>
                </div>

                {isActive ? (
                  <div className="ps-card-body">
                    <div className="session-info">
                      <p><strong>Customer:</strong> {session.customer_name || 'Walk-in'}</p>
                      {session.customer_phone && <p><strong>Phone:</strong> {session.customer_phone}</p>}
                      <p><strong>Mode:</strong> {session.mode === 'multi' ? '👥 Multi Player' : '👤 Single Player'}</p>
                      <p><strong>Started:</strong> {new Date(session.start_time).toLocaleTimeString()}</p>
                      <p><strong>Time Elapsed:</strong> {(elapsedTime[ps.id] || 0).toFixed(2)}h</p>
                      <p><strong>Rate:</strong> ${getCurrentRate(pricing[ps.id]?.[session.mode || 'single']).toFixed(2)}/hr</p>
                      <p><strong>Game:</strong> ${(currentCost[ps.id] || 0).toFixed(2)}</p>
                      <p><strong>Products:</strong> ${items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2)}</p>
                      <p className="total"><strong>Total:</strong> ${((currentCost[ps.id] || 0) + items.reduce((sum, i) => sum + i.subtotal, 0)).toFixed(2)}</p>
                    </div>

                    <div className="order-items">
                      <h4>Order Items:</h4>
                      {items.length === 0 ? (
                        <p className="no-items">No items added</p>
                      ) : (
                        <ul>
                          {items.map((item) => (
                            <li key={item.id}>
                              {item.product_name} x{item.quantity} - ${item.subtotal.toFixed(2)}
                              <button 
                                onClick={() => handleRemoveItem(item.id)}
                                className="btn-remove"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="ps-card-actions">
                      <button 
                        onClick={() => openAddItemModal(session)}
                        className="btn btn-primary"
                      >
                        + Add Item
                      </button>
                      <button 
                        onClick={() => openEndModal(session)}
                        className="btn btn-danger"
                      >
                        End Session
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ps-card-body">
                    <p>No active session</p>
                    <button 
                      onClick={() => openStartModal(ps)}
                      className="btn btn-success btn-block"
                    >
                      Start Session
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Start Session Modal */}
      {showStartModal && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Start Session - {selectedPS?.name}</h2>
            <form onSubmit={handleStartSession}>
              <div className="form-group">
                <label>Customer Name (optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="form-group">
                <label>Phone Number (optional)</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes..."
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Session Mode</label>
                <div className="mode-selection">
                  <label className="mode-option">
                    <input
                      type="radio"
                      name="mode"
                      value="single"
                      checked={mode === 'single'}
                      onChange={(e) => setMode(e.target.value)}
                    />
                    <span>👤 Single Player</span>
                    <span className="mode-price">
                      ${pricing[selectedPS?.id]?.single?.weekday_rate?.toFixed(2) || '0.00'}/hr
                      (day)
                    </span>
                  </label>
                  <label className="mode-option">
                    <input
                      type="radio"
                      name="mode"
                      value="multi"
                      checked={mode === 'multi'}
                      onChange={(e) => setMode(e.target.value)}
                    />
                    <span>👥 Multi Player</span>
                    <span className="mode-price">
                      ${pricing[selectedPS?.id]?.multi?.weekday_rate?.toFixed(2) || '0.00'}/hr
                      (day)
                    </span>
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowStartModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  Start Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Session Modal */}
      {showEndModal && selectedSession && (
        <div className="modal-overlay" onClick={() => setShowEndModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>End Session</h2>
            <div className="session-summary">
              <p><strong>PlayStation:</strong> {selectedSession.playstation_name}</p>
              <p><strong>Customer:</strong> {selectedSession.customer_name || 'Walk-in'}</p>
              <p><strong>Mode:</strong> {selectedSession.mode === 'multi' ? '👥 Multi Player' : '👤 Single Player'}</p>
              <p><strong>Start Time:</strong> {new Date(selectedSession.start_time).toLocaleString()}</p>
              <p><strong>Game Time:</strong> {((Date.now() - new Date(selectedSession.start_time)) / 1000 / 60 / 60).toFixed(2)} hours</p>
            </div>

            <div className="order-summary">
              <h4>Order Items:</h4>
              {orderItems[selectedSession.id]?.length === 0 ? (
                <p>No items ordered</p>
              ) : (
                <ul>
                  {orderItems[selectedSession.id]?.map((item) => (
                    <li key={item.id}>
                      {item.product_name} x{item.quantity} - ${item.subtotal.toFixed(2)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="total-display">
              <p>Game Cost: ${(currentCost[selectedSession.playstation_id] || 0).toFixed(2)}</p>
              <p>Products: ${(orderItems[selectedSession.id]?.reduce((sum, i) => sum + i.subtotal, 0) || 0).toFixed(2)}</p>
              <p className="total">
                Total: ${((currentCost[selectedSession.playstation_id] || 0) + (orderItems[selectedSession.id]?.reduce((sum, i) => sum + i.subtotal, 0) || 0)).toFixed(2)}
              </p>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={() => setShowEndModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleEndSession} className="btn btn-success">
                Confirm & End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="modal-overlay" onClick={() => setShowAddItemModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Item to Order</h2>
            <form onSubmit={handleAddItem}>
              <div className="form-group">
                <label>Product</label>
                <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} required>
                  <option value="">Select a product</option>
                  {categories.map((cat) => (
                    <optgroup key={cat.id} label={cat.name}>
                      {products.filter(p => p.category_id === cat.id).map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} - ${prod.price.toFixed(2)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddItemModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkerView;
