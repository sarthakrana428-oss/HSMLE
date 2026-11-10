/**
 * HSMLE India Corporation - API Client Module
 * Handles all communication with the FastAPI backend.
 */

const API_CONFIG = {
  // If frontend is served on 8000, use relative path, otherwise point to FastAPI server on the same host
  BASE_URL: (window.location.port === '8000') ? '' : `http://${window.location.hostname || '127.0.0.1'}:8000`,
  API_PREFIX: '/api',
};

const API = {
  getBaseUrl() {
    return API_CONFIG.BASE_URL;
  },

  getApiUrl(endpoint) {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}${endpoint}`;
  },

  resolveImageUrl(path) {
    if (!path) return '/assets/images/product-placeholder.svg';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${API_CONFIG.BASE_URL}${path}${sep}v=hsmle_v12_single_wm`;
  },

  async getGalleryManifest() {
    if (this._galleryManifest) return this._galleryManifest;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/static/images/products/gallery_manifest.json?v=cover_only_v10`);
      if (res.ok) {
        this._galleryManifest = await res.json();
        return this._galleryManifest;
      }
    } catch (e) {
      console.warn('Could not load gallery manifest:', e);
    }
    return {};
  },

  resolveCatalogueUrl(path) {
    if (!path) return '#';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${API_CONFIG.BASE_URL}${path}`;
  },

  resolveVideoUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${API_CONFIG.BASE_URL}${path}${sep}v=hsmle_v12_single_wm`;
  },

  resolvePdfDownloadUrl(productId) {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/products/${productId}/download-pdf`;
  },

  async request(endpoint, options = {}) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${this.getApiUrl(endpoint)}${sep}_t=${Date.now()}`;
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        let errorDetail = `HTTP Error ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch (_) {}
        throw new Error(errorDetail);
      }

      return await response.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Categories
  async getCategories() {
    return await this.request('/categories');
  },

  async getCategory(slug) {
    return await this.request(`/categories/${slug}`);
  },

  // Products
  async getProducts(params = {}) {
    const query = new URLSearchParams();
    if (params.category_slug) query.set('category_slug', params.category_slug);
    if (params.subcategory_slug) query.set('subcategory_slug', params.subcategory_slug);
    if (params.search) query.set('search', params.search);
    if (params.featured_only || params.featured) query.set('featured_only', 'true');
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/products${queryString}`);
  },

  async getFeaturedProducts(limit = 8) {
    return await this.request(`/products/featured?limit=${limit}`);
  },

  async getProduct(idOrSlug) {
    return await this.request(`/products/${idOrSlug}`);
  },

  async compareProducts(ids) {
    const idList = Array.isArray(ids) ? ids.join(',') : ids;
    return await this.request(`/products/compare?ids=${encodeURIComponent(idList)}`);
  },

  // Enquiries
  async submitEnquiry(data) {
    return await this.request('/enquiries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Quotations (RFQ)
  async submitQuotation(data) {
    return await this.request('/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

window.API = API;
