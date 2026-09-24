import { apiClient } from './client';

export const langgraphApi = {
  sendGraphChat: (prompt, thread_id = 'session_1') =>
    apiClient.post('/api/v1/graph/chat', { prompt, thread_id }),

  getThreadMemory: (thread_id) =>
    apiClient.get(`/api/v1/graph/memory/${thread_id}`),
};
