import { apiClient } from './client';

export const ragApi = {
  // POST /api/v1/rag/upload
  uploadPdf: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/v1/rag/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // POST /api/v1/rag/chunk
  chunkPdf: (filename, chunkSize = 500, chunkOverlap = 50) => {
    return apiClient.post('/api/v1/rag/chunk', { filename, chunk_size: chunkSize, chunk_overlap: chunkOverlap });
  },

  // POST /api/v1/rag/embed
  embedPdf: (filename, chunkSize = 500, chunkOverlap = 50) => {
    return apiClient.post('/api/v1/rag/embed', { filename, chunk_size: chunkSize, chunk_overlap: chunkOverlap });
  },

  // POST /api/v1/rag/hybrid-search
  hybridSearch: (query, topK = 3, rrfK = 60) => {
    return apiClient.post('/api/v1/rag/hybrid-search', { query, top_k: topK, rrf_k: rrfK });
  },
};
