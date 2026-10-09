const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('adminToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('adminToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('adminToken');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const isFormData = options.body instanceof FormData;
    const config = {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    
    if (response.status === 401 || response.status === 403) {
      this.clearToken();
      window.location.href = '/login';
      return;
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body.error || body.message || '';
      } catch {
        detail = response.status === 404 ? 'Endpoint not found — backend may need redeploying' : '';
      }
      throw new Error(detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data;
  }

  // Articles
  async getArticles() {
    return this.request('/admin/articles');
  }

  async createArticle(article) {
    return this.request('/admin/articles', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  }

  async updateArticle(id, article) {
    return this.request(`/admin/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(article),
    });
  }

  async deleteArticle(id) {
    return this.request(`/admin/articles/${id}`, {
      method: 'DELETE',
    });
  }

  // File upload
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/admin/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });
  }

  // Gallery
  async getGallery() {
    return this.request('/gallery');
  }

  async createGalleryItem(item) {
    return this.request('/admin/gallery', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateGalleryItem(id, item) {
    return this.request(`/admin/gallery/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  }

  async deleteGalleryItem(id) {
    return this.request(`/admin/gallery/${id}`, {
      method: 'DELETE',
    });
  }

  // Social Links
  async getSocialLinks() {
    return this.request('/social-links');
  }

  async createSocialLink(link) {
    return this.request('/admin/social-links', {
      method: 'POST',
      body: JSON.stringify(link),
    });
  }

  async updateSocialLink(id, link) {
    return this.request(`/admin/social-links/${id}`, {
      method: 'PUT',
      body: JSON.stringify(link),
    });
  }

  async deleteSocialLink(id) {
    return this.request(`/admin/social-links/${id}`, {
      method: 'DELETE',
    });
  }

  // Feature flags
  async getFlags() {
    return this.request('/admin/flags');
  }

  async setFlag(key, state) {
    return this.request(`/admin/flags/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ state }),
    });
  }

  // Hot Takes
  async getHotTakes() {
    return this.request('/admin/hot-takes');
  }

  // Instants
  async getInstants() {
    return this.request('/admin/instants');
  }

  async createInstant(instant) {
    return this.request('/admin/instants', {
      method: 'POST',
      body: JSON.stringify(instant),
    });
  }

  async updateInstant(id, instant) {
    return this.request(`/admin/instants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(instant),
    });
  }

  async deleteInstant(id) {
    return this.request(`/admin/instants/${id}`, {
      method: 'DELETE',
    });
  }

  async getWaitlist() {
    return this.request('/admin/waitlist');
  }

  async setWaitlistStatus(id, status) {
    return this.request(`/admin/waitlist/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async createHotTake(take) {
    return this.request('/admin/hot-takes', {
      method: 'POST',
      body: JSON.stringify(take),
    });
  }

  async updateHotTake(id, take) {
    return this.request(`/admin/hot-takes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(take),
    });
  }

  async deleteHotTake(id) {
    return this.request(`/admin/hot-takes/${id}`, {
      method: 'DELETE',
    });
  }

  // System Health
  async getHealth() {
    return this.request('/health');
  }

  // Audit Logs
  async getAuditLogs(limit = 50) {
    return this.request(`/admin/audit-logs?limit=${limit}`);
  }
}

export const api = new ApiClient();
