import { apiClient } from './client';

export const routerApi = {
  classifyPrompt: (prompt) => apiClient.post('/agent/ask', { prompt }),
};
