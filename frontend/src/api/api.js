const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3000';

class ApiClient {
  constructor() {
    this.baseURL = `${API_BASE}/api`;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Authentication endpoints
  async login(credentials) {
    return this.post('/login', credentials);
  }

  async logout() {
    return this.post('/logout');
  }

  async getSession() {
    return this.get('/session');
  }

  // Voting endpoints
  async getCurrentVote() {
    return this.get('/current-vote');
  }

  async submitVote(choices) {
    return this.post('/submit-vote', { choices });
  }

  async getUserVoteStatus() {
    return this.get('/user-vote-status');
  }

  // Admin endpoints
  async startVote(voteData) {
    return this.post('/admin/start-vote', voteData);
  }

  async endVote() {
    return this.post('/admin/end-vote');
  }

  async getUsers() {
    return this.get('/admin/users');
  }

  async logoutUser(userId) {
    return this.post('/admin/logout-user', { userId });
  }

  async getResults() {
    return this.get('/admin/results');
  }

  async getDashboard() {
    return this.get('/admin/dashboard');
  }

  async exportResults(format = 'json') {
    const response = await this.request(`/admin/export?format=${format}`, {
      method: 'GET',
    });
    return response;
  }

  // New endpoints for enhanced features
  async getAllVotes() {
    return this.get('/admin/all-votes');
  }

  async getVoteDetails(voteId) {
    return this.get(`/admin/vote-details/${voteId}`);
  }

  async addUser(userData) {
    return this.post('/admin/add-user', userData);
  }

  async deleteUser(userId) {
    return this.request(`/admin/delete-user/${userId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
export default api;
