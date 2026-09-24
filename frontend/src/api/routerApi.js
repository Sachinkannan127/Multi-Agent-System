import { apiClient } from './client';

export const routerApi = {
  // POST /api/v1/router/chat
  sendRouterChat: (prompt, provider = 'gemini', topK = 3) => {
    return apiClient.post('/api/v1/router/chat', { prompt, provider, top_k: topK });
  },

  // POST /api/v1/router/classify
  classifyPrompt: (prompt) => {
    return apiClient.post('/api/v1/router/classify', { prompt });
  },
};
