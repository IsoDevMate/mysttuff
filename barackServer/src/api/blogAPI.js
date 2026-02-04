const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class BlogAPI {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Public API methods
  async getArticles() {
    return this.request('/articles');
  }

  async getArticle(slug) {
    return this.request(`/articles/${slug}`);
  }

  async getGallery() {
    return this.request('/gallery');
  }

  async getSocialLinks() {
    return this.request('/social-links');
  }
}

export const blogAPI = new BlogAPI();
