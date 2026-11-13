/**
 * HSMLE India Corporation - Admin API Client
 * Handles authenticated requests to the protected FastAPI administrative endpoints.
 */

const ADMIN_TOKEN_KEY = 'hsmle_admin_token';
const ADMIN_USER_KEY = 'hsmle_admin_user';

const AdminAPI = {
  getBaseUrl() {
    return (window.location.port === '8000') ? '' : `http://${window.location.hostname || '127.0.0.1'}:8000`;
  },

  getToken() {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token') || params.get('auth_token');
      if (urlToken) {
        localStorage.setItem(ADMIN_TOKEN_KEY, urlToken);
        const urlRole = params.get('role') || 'super_admin';
        const urlUser = params.get('user') || 'admin';
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify({
          username: (urlUser === 'admin' ? 'Azad Sirohi' : urlUser),
          email: 'info@hsmleindia.com',
          role: urlRole,
          full_name: (urlRole === 'super_admin' || urlUser === 'admin') ? 'Azad Sirohi' : 'Staff Editor'
        }));
        return urlToken;
      }
    } catch (_) {}
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  },

  setAuth(token, user) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    if (user) {
      if (user.role === 'super_admin' || user.username === 'admin') {
        user.username = 'Azad Sirohi';
        user.full_name = 'Azad Sirohi';
      }
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    }
  },

  clearAuth() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  },

  getUser() {
    try {
      const data = localStorage.getItem(ADMIN_USER_KEY);
      if (!data) return null;
      const user = JSON.parse(data);
      if (user && (user.role === 'super_admin' || user.username === 'admin')) {
        user.username = 'Azad Sirohi';
        user.full_name = 'Azad Sirohi';
      }
      return user;
    } catch (_) {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  checkAuthOrRedirect() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  async request(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}/api/admin${endpoint}`;
    const token = this.getToken();

    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      if (res.status === 401) {
        // Unauthorized - session expired
        this.clearAuth();
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html?expired=1';
        }
        throw new Error('Administrative session expired. Please log in again.');
      }

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errData = await res.json();
          if (errData && errData.detail) {
            errMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch (_) {}
        throw new Error(errMessage);
      }

      return await res.json();
    } catch (err) {
      console.error(`Admin API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth
  async login(username, password) {
    const res = await fetch(`${this.getBaseUrl()}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      let errMessage = 'Invalid credentials';
      try {
        const err = await res.json();
        if (err && err.detail) errMessage = err.detail;
      } catch (_) {}
      throw new Error(errMessage);
    }

    const data = await res.json();
    this.setAuth(data.access_token, {
      username: data.username,
      email: data.email,
      role: data.role || 'super_admin'
    });
    return data;
  },

  logout() {
    this.clearAuth();
    window.location.href = 'login.html';
  },

  async getMe() {
    return await this.request('/me');
  },

  // Dashboard & Audit
  async getStats() {
    return await this.request('/stats');
  },

  async getAuditLogs(page = 1, limit = 25, action = '') {
    const q = new URLSearchParams({ page, limit });
    if (action) q.set('action', action);
    return await this.request(`/audit-logs?${q.toString()}`);
  },

  // Products
  async getProducts(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.category_id) q.set('category_id', params.category_id);
    if (params.subcategory_id) q.set('subcategory_id', params.subcategory_id);
    if (params.is_active !== undefined && params.is_active !== '') q.set('is_active', params.is_active);
    if (params.page) q.set('page', params.page);
    if (params.limit) q.set('limit', params.limit);
    return await this.request(`/products?${q.toString()}`);
  },

  async getProduct(id) {
    return await this.request(`/products/${id}`);
  },

  async createProduct(data) {
    return await this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProduct(id, data) {
    return await this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async toggleProductStatus(id) {
    return await this.request(`/products/${id}/toggle-status`, {
      method: 'PATCH'
    });
  },

  async deleteProduct(id) {
    return await this.request(`/products/${id}`, {
      method: 'DELETE'
    });
  },

  async uploadProductImage(id, file) {
    const formData = new FormData();
    formData.append('file', file);
    return await this.request(`/products/${id}/upload-image`, {
      method: 'POST',
      body: formData
    });
  },

  async uploadProductCatalogue(id, file) {
    const formData = new FormData();
    formData.append('file', file);
    return await this.request(`/products/${id}/upload-catalogue`, {
      method: 'POST',
      body: formData
    });
  },

  // Categories
  async getCategories() {
    return await this.request('/categories');
  },

  async createCategory(data) {
    return await this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCategory(id, data) {
    return await this.request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async createSubcategory(data) {
    return await this.request('/subcategories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateSubcategory(id, data) {
    return await this.request(`/subcategories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Enquiries
  async getEnquiries(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status_filter) q.set('status_filter', params.status_filter);
    if (params.page) q.set('page', params.page);
    if (params.limit) q.set('limit', params.limit);
    return await this.request(`/enquiries?${q.toString()}`);
  },

  async getEnquiry(id) {
    return await this.request(`/enquiries/${id}`);
  },

  async updateEnquiry(id, status, admin_notes = null) {
    return await this.request(`/enquiries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_notes })
    });
  },

  // Quotations
  async getQuotations(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status_filter) q.set('status_filter', params.status_filter);
    if (params.page) q.set('page', params.page);
    if (params.limit) q.set('limit', params.limit);
    return await this.request(`/quotations?${q.toString()}`);
  },

  async getQuotation(id) {
    return await this.request(`/quotations/${id}`);
  },

  async updateQuotation(id, status, admin_notes = null) {
    return await this.request(`/quotations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_notes })
    });
  },

  // 30-Second HD Product Videos
  async getVideoStatus(productId) {
    const res = await fetch(`${this.getBaseUrl()}/api/videos/status/${productId}`);
    return await res.json();
  },

  async generateProductVideo(productId, force = false) {
    const res = await fetch(`${this.getBaseUrl()}/api/videos/generate/${productId}?force=${force}&background=false`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to generate video');
    }
    return await res.json();
  },

  async deleteProductVideo(productId) {
    const res = await fetch(`${this.getBaseUrl()}/api/videos/${productId}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  async startBatchVideoGeneration(productIds = null) {
    const res = await fetch(`${this.getBaseUrl()}/api/videos/batch-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_ids: productIds })
    });
    return await res.json();
  },

  async getBatchVideoStatus() {
    const res = await fetch(`${this.getBaseUrl()}/api/videos/batch-status`);
    return await res.json();
  }
};

window.AdminAPI = AdminAPI;
