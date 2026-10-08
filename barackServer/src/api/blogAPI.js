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

  async getHotTakes() {
    return this.request('/hot-takes');
  }

  async getInstants(limit = 50) {
    return this.request(`/instants?limit=${limit}`);
  }

  async getThoughts(instantId) {
    return this.request(`/instants/${instantId}/thoughts`);
  }

  async postThought(instantId, thought) {
    return this.request(`/instants/${instantId}/thoughts`, {
      method: "POST",
      body: JSON.stringify(thought),
    });
  }

  async joinWaitlist(email, name) {
    return this.request("/waitlist", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    });
  }
}

export const blogAPI = new BlogAPI();
