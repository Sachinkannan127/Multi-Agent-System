import axios from 'axios';

export const API_BASE_URL = 'http://127.0.0.1:8990';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMsg = error.response?.data?.detail || error.message || 'API Server Error';
    console.error('API Request Error:', errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
);
