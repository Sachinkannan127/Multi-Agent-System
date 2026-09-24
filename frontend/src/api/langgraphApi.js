import { apiClient } from './client';

export const langgraphApi = {
  // POST /api/v1/graph/chat
  sendGraphChat: (prompt, threadId = 'default_session') => {
    return apiClient.post('/api/v1/graph/chat', { prompt, thread_id: threadId });
  },

  // GET /api/v1/graph/memory/{thread_id}
  getThreadMemory: (threadId) => {
    return apiClient.get(`/api/v1/graph/memory/${threadId}`);
  },
};
