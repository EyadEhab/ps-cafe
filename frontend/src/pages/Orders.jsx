import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { sessionApi, orderApi, productApi } from '../utils/api.js';

function Orders() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [addQuantity, setAddQuantity] = useState(1);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadSessions();
    loadProducts();
  }, [filterDate]);

  const loadSessions = async () => {
    try {
      const { data } = await sessionApi.getAll({ 
        start_date: filterDate,
        end_date: filterDate
      });
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productApi.getAll({ active_only: true }),
        productApi.getCategories()
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleViewSession = async (session) => {
    setSelectedSession(session);
    try {
      const { data } = await orderApi.getSessionItems(session.id);
      setOrderItems(data);
    } catch (error) {
      console.error('Failed to load order items:', error);
      setOrderItems([]);
    }
  };

  const refreshSession = async (sessionId) => {
    try {
      // Re-fetch the session to get updated totals
      const { data: sessions } = await sessionApi.getAll({ limit: 1000 });
      const updatedSession = sessions.find(s => s.id === sessionId);
      if (updatedSession) {
        setSelectedSession(updatedSession);
      }
      // Also refresh order items
      const { data: items } = await orderApi.getSessionItems(sessionId);
      setOrderItems(items);
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
    setShowEditModal(true);
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    try {
      await orderApi.updateItem(editingItem.id, { quantity: editQuantity });
      setShowEditModal(false);
      await refreshSession(selectedSession.id); // Refresh session data from server
      loadSessions(); // Refresh the sessions list to update totals
    } catch (error) {
      alert('Failed to update item: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Remove this item from the order?')) return;
    try {
      await orderApi.removeItem(itemId);
      await refreshSession(selectedSession.id); // Refresh session data from server
      loadSessions(); // Refresh the sessions list to update totals
    } catch (error) {
      alert('Failed to remove item: ' + (error.response?.data?.error || error.message));
    }
  };

  const canDeleteSession = (session) => {
    if (!session.end_time) return false; // Can't delete active sessions
    // Admins can delete anytime, workers only within 24 hours
    if (user?.role === 'admin') return true;
    // Use Cairo timezone for comparison
    const endTime = new Date(session.end_time);
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const hoursDiff = (now - endTime) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  const canEditOrder = (session) => {
    // Admins can edit anytime, workers can edit if session is active OR ended within 24 hours
    if (user?.role === 'admin') return true;
    if (!session.end_time) return true; // Active session
    // Use Cairo timezone for comparison
    const endTime = new Date(session.end_time);
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const hoursDiff = (now - endTime) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Delete this entire order? This cannot be undone.')) return;
    try {
      // First delete all order items
      const items = await orderApi.getSessionItems(sessionId);
      for (const item of items.data) {
        await orderApi.removeItem(item.id);
      }
      // Then delete the session
      await sessionApi.delete(sessionId);
      loadSessions();
      setSelectedSession(null);
      setOrderItems([]);
    } catch (error) {
      alert('Failed to delete order: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleOpenAddItemModal = () => {
    setShowAddItemModal(true);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await orderApi.addItem({
        session_id: selectedSession.id,
        product_id: parseInt(selectedProduct),
        quantity: parseInt(addQuantity)
      });
      setShowAddItemModal(false);
      setSelectedProduct('');
      setAddQuantity(1);
      await refreshSession(selectedSession.id); // Refresh session data from server
      loadSessions(); // Refresh the sessions list to update totals
    } catch (error) {
      alert('Failed to add item: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCloseModal = () => {
    setSelectedSession(null);
    setOrderItems([]);
  };

  if (loading) return <div className="loading">Loading...</div>;

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
          <button onClick={() => logout()} className="btn btn-secondary">Logout</button>
        </div>
      </nav>

      <main className="main-content">
        <div className="page-header">
          <h1>Orders</h1>
          <div className="filter-group">
            <label>Filter by Date:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="date-filter"
            />
          </div>
        </div>
        <p className="help-text">
          View and manage orders. Admins can edit anytime. Workers can edit product quantities or delete orders within 24 hours of session end time.
        </p>
        <div className="info-box">
          {user?.role === 'admin' ? (
            <p><strong>Note:</strong> As an admin, you can edit or delete any order at any time.</p>
          ) : (
            <p><strong>Note:</strong> Delete button appears only for completed sessions that ended within the last 24 hours.</p>
          )}
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>PlayStation</th>
              <th>Customer</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Mode</th>
              <th>Game</th>
              <th>Products</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>#{session.id}</td>
                <td>{session.playstation_name}</td>
                <td>
                  {session.customer_name || 'Walk-in'}
                  {session.customer_phone && (
                    <div className="text-small">{session.customer_phone}</div>
                  )}
                </td>
                <td>{new Date(session.start_time).toLocaleString()}</td>
                <td>{session.end_time ? new Date(session.end_time).toLocaleString() : '-'}</td>
                <td>{session.mode === 'multi' ? '👥 Multi' : '👤 Single'}</td>
                <td>${session.game_cost?.toFixed(2) || '0.00'}</td>
                <td>${session.product_cost?.toFixed(2) || '0.00'}</td>
                <td className="total-cell">${session.total_cost?.toFixed(2) || '0.00'}</td>
                <td>
                  <span className={`status-badge ${session.status}`}>
                    {session.status}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleViewSession(session)}
                    className="btn btn-sm btn-primary"
                    disabled={!canEditOrder(session)}
                    title={!canEditOrder(session) ? (user?.role === 'admin' ? 'Edit not available' : 'Can only edit within 24 hours of end time') : 'View/Edit Order'}
                  >
                    View/Edit
                  </button>
                  {canDeleteSession(session) && (
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="btn btn-sm btn-danger"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order Details - Session #{selectedSession.id}</h2>
              <button onClick={handleCloseModal} className="btn-close">✕</button>
            </div>
            
            <div className="session-summary">
              <p><strong>PlayStation:</strong> {selectedSession.playstation_name}</p>
              <p><strong>Customer:</strong> {selectedSession.customer_name || 'Walk-in'}</p>
              <p><strong>Mode:</strong> {selectedSession.mode === 'multi' ? '👥 Multi Player' : '👤 Single Player'}</p>
              <p><strong>Start:</strong> {new Date(selectedSession.start_time).toLocaleString()}</p>
              {selectedSession.end_time && (
                <p><strong>End:</strong> {new Date(selectedSession.end_time).toLocaleString()}</p>
              )}
            </div>

            <div className="order-section">
              <div className="order-header">
                <h3>Order Items</h3>
                {canEditOrder(selectedSession) && (
                  <button onClick={handleOpenAddItemModal} className="btn btn-sm btn-success">
                    + Add Item
                  </button>
                )}
              </div>
              
              {orderItems.length === 0 ? (
                <p className="no-items">No items in this order</p>
              ) : (
                <table className="data-table order-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td>${item.unit_price.toFixed(2)}</td>
                        <td>x{item.quantity}</td>
                        <td>${item.subtotal.toFixed(2)}</td>
                        <td>
                          <button 
                            onClick={() => handleOpenEditModal(item)}
                            className="btn btn-sm btn-secondary"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(item.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="order-totals">
              <div className="total-row">
                <span>Game Cost:</span>
                <span>${selectedSession.game_cost?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="total-row">
                <span>Products:</span>
                <span>${selectedSession.product_cost?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="total-row total">
                <span>Total:</span>
                <span>${selectedSession.total_cost?.toFixed(2) || '0.00'}</span>
              </div>
            </div>

            {canDeleteSession(selectedSession) && (
              <div className="delete-warning">
                <p>⚠️ This order can be deleted (within 24 hours of end time)</p>
              </div>
            )}

            <div className="modal-actions">
              <button onClick={handleCloseModal} className="btn btn-secondary">
                Close
              </button>
              {canDeleteSession(selectedSession) && (
                <button
                  onClick={() => handleDeleteSession(selectedSession.id)}
                  className="btn btn-danger"
                >
                  Delete Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Item Quantity</h2>
            <p><strong>Product:</strong> {editingItem.product_name}</p>
            <p><strong>Current Quantity:</strong> {editingItem.quantity}</p>
            <form onSubmit={handleUpdateItem}>
              <div className="form-group">
                <label>New Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update
                </button>
              </div>
            </form>
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
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
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

export default Orders;
