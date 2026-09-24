import { apiClient } from './client';

export const healthApi = {
  getHealth: () => apiClient.get('/health'),
  getMongoPing: () => apiClient.get('/mongo/ping'),
};
