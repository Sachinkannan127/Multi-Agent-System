import { apiClient } from './client';

export const toolsApi = {
  tavilySearch: (query, search_depth = 'basic') =>
    apiClient.post('/api/v1/tools/tavily', { query, search_depth }),

  scrapegraphScrape: (url, prompt = 'Extract key summary and titles') =>
    apiClient.post('/api/v1/tools/scrapegraph', { url, prompt }),

  scrapegraphMultiScrape: (urls, prompt = 'Extract summary and main content') =>
    apiClient.post('/api/v1/tools/scrapegraph/multi', { urls, prompt }),
};
