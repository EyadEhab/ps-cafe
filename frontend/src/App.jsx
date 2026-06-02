import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.js';
import { authApi } from './utils/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PlayStations from './pages/PlayStations.jsx';
import WorkerView from './pages/WorkerView.jsx';
import Products from './pages/Products.jsx';
import Pricing from './pages/Pricing.jsx';
import Orders from './pages/Orders.jsx';
import Reports from './pages/Reports.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Users from './pages/Users.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const data = await authApi.login(username, password);
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Redirect worker to worker view, admin to dashboard
  const defaultPath = user?.role === 'worker' ? '/worker' : '/';

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to={defaultPath} />} />
          <Route path="/" element={user?.role === 'admin' ? <Dashboard /> : <Navigate to="/worker" />} />
          <Route path="/worker" element={user ? <WorkerView /> : <Navigate to="/login" />} />
          <Route path="/playstations" element={user?.role === 'admin' ? <PlayStations /> : <Navigate to="/" />} />
          <Route path="/users" element={user?.role === 'admin' ? <Users /> : <Navigate to="/" />} />
          <Route path="/products" element={user?.role === 'admin' ? <Products /> : <Navigate to="/" />} />
          <Route path="/pricing" element={user?.role === 'admin' ? <Pricing /> : <Navigate to="/" />} />
          <Route path="/orders" element={user ? <Orders /> : <Navigate to="/login" />} />
          <Route path="/reports" element={user?.role === 'admin' ? <Reports /> : <Navigate to="/" />} />
          <Route path="/audit" element={user?.role === 'admin' ? <AuditLog /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
