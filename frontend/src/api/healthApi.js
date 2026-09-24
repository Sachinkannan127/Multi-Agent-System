import { apiClient } from './client';

export const healthApi = {
  // GET /health
  getHealthStatus: () => {
    return apiClient.get('/health');
  },

  // GET /mongo/ping
  getMongoPing: () => {
    return apiClient.get('/mongo/ping');
  },
};
