import { apiClient } from './client';

export const toolsApi = {
  // POST /api/v1/agent/tavily-search
  tavilySearch: (query, maxResults = 5) => {
    return apiClient.post('/api/v1/agent/tavily-search', { query, max_results: maxResults });
  },

  // POST /api/v1/agent/realtime-scrape
  realtimeScrape: (urls, prompt) => {
    return apiClient.post('/api/v1/agent/realtime-scrape', { urls: Array.isArray(urls) ? urls : [urls], prompt });
  },

  // GET /api/v1/agent/tools
  getToolsList: () => {
    return apiClient.get('/api/v1/agent/tools');
  },
};
