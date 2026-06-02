import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    return data;
  }
};

export const playstationApi = {
  getAll: () => api.get('/playstations'),
  getOne: (id) => api.get(`/playstations/${id}`),
  create: (data) => api.post('/playstations', data),
  update: (id, data) => api.put(`/playstations/${id}`, data),
  delete: (id) => api.delete(`/playstations/${id}`)
};

export const sessionApi = {
  getAll: (params) => api.get('/sessions', { params }),
  getActive: (playstationId) => api.get(`/sessions/active/${playstationId}`),
  start: (data) => api.post('/sessions/start', data),
  end: (id, data) => api.post(`/sessions/${id}/end`, data),
  getDetails: (id) => api.get(`/sessions/${id}/details`),
  delete: (id) => api.delete(`/sessions/${id}`)
};

export const productApi = {
  getCategories: () => api.get('/products/categories'),
  createCategory: (data) => api.post('/products/categories', data),
  updateCategory: (id, data) => api.put(`/products/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/products/categories/${id}`),
  getAll: (params) => api.get('/products', { params }),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
};

export const orderApi = {
  addItem: (data) => api.post('/orders/add-item', data),
  removeItem: (id) => api.delete(`/orders/items/${id}`),
  updateItem: (id, data) => api.put(`/orders/items/${id}`, data),
  getSessionItems: (sessionId) => api.get(`/orders/session/${sessionId}`)
};

export const pricingApi = {
  getAll: () => api.get('/pricing'),
  getByPlaystation: (playstationId) => api.get(`/pricing/${playstationId}`),
  update: (id, data) => api.put(`/pricing/${id}`, data)
};

export const reportApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getSessions: (params) => api.get('/reports/sessions', { params }),
  getRevenue: (params) => api.get('/reports/revenue', { params })
};

export const auditApi = {
  getAll: (params) => api.get('/audit', { params }),
  getByEntity: (entityType, entityId) => api.get(`/audit/entity/${entityType}/${entityId}`)
};
