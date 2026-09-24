import { apiClient } from './client';

export const ragApi = {
  uploadPdf: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/upload_pdf/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  embedPdf: (filename) => apiClient.post('/embed_pdf/', { filename }),

  hybridSearch: (query, top_k = 3, rrf_k = 60) =>
    apiClient.post('/api/v1/search/hybrid', { query, top_k, rrf_k }),
};
