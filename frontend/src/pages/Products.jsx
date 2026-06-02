import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { productApi } from '../utils/api.js';

function Products() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    description: '',
    price: '',
    cost: '',
    stock_quantity: ''
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productApi.getAll(),
        productApi.getCategories()
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProductModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        category_id: product.category_id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        cost: product.cost || '',
        stock_quantity: product.stock_quantity || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        category_id: categories[0]?.id || '',
        name: '',
        description: '',
        price: '',
        cost: '',
        stock_quantity: ''
      });
    }
    setShowProductModal(true);
  };

  const handleOpenCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, description: category.description || '' });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '' });
    }
    setShowCategoryModal(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        category_id: parseInt(formData.category_id),
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0
      };

      if (editingProduct) {
        await productApi.update(editingProduct.id, data);
      } else {
        await productApi.create(data);
      }
      setShowProductModal(false);
      loadData();
    } catch (error) {
      alert('Failed to save: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await productApi.updateCategory(editingCategory.id, categoryForm);
      } else {
        await productApi.createCategory(categoryForm);
      }
      setShowCategoryModal(false);
      loadData();
    } catch (error) {
      alert('Failed to save: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Are you sure you want to deactivate this product?')) return;
    try {
      await productApi.delete(id);
      loadData();
    } catch (error) {
      alert('Failed to delete: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteCategory = async (id, name, productCount) => {
    if (productCount > 0) {
      alert('Cannot delete category with products. Please remove all products first.');
      return;
    }
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await productApi.deleteCategory(id);
      loadData();
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
          <h1>Products Management</h1>
          {user?.role === 'admin' && (
            <div className="header-actions">
              <button onClick={() => handleOpenCategoryModal()} className="btn btn-secondary">
                + Add Category
              </button>
              <button onClick={() => handleOpenProductModal()} className="btn btn-primary">
                + Add Product
              </button>
            </div>
          )}
        </div>

        <div className="products-by-category">
          {categories.map((cat) => {
            const catProducts = products.filter(p => p.category_id === cat.id);
            return (
              <div key={cat.id} className="category-section">
                <div className="category-header">
                  <h2>{cat.name}</h2>
                  <div className="category-actions">
                    <span className="badge">{catProducts.length} products</span>
                    {user?.role === 'admin' && (
                      <>
                        <button 
                          onClick={() => handleOpenCategoryModal(cat)} 
                          className="btn btn-sm btn-secondary"
                          disabled={catProducts.length > 0}
                          title={catProducts.length > 0 ? 'Cannot edit category with products' : 'Edit category'}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id, cat.name, catProducts.length)} 
                          className="btn btn-sm btn-danger"
                          disabled={catProducts.length > 0}
                          title={catProducts.length > 0 ? 'Cannot delete category with products' : 'Delete category'}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Price</th>
                      <th>Cost</th>
                      <th>Stock</th>
                      <th>Status</th>
                      {user?.role === 'admin' && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {catProducts.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.description || '-'}</td>
                        <td>${product.price.toFixed(2)}</td>
                        <td>${(product.cost || 0).toFixed(2)}</td>
                        <td>{product.stock_quantity}</td>
                        <td>
                          <span className={`status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {user?.role === 'admin' && (
                          <td>
                            <button onClick={() => handleOpenProductModal(product)} className="btn btn-sm btn-secondary">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteProduct(product.id)} className="btn btn-sm btn-danger">
                              Deactivate
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </main>

      {/* Product Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleProductSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
            <form onSubmit={handleCategorySubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
