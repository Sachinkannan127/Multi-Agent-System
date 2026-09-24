import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8990';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60s timeout for web scraping / LLM generation
});

// Interceptor for uniform response & error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMsg = error.response?.data?.detail || error.message || 'An unexpected API error occurred.';
    console.error('API Request Error:', errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
);
