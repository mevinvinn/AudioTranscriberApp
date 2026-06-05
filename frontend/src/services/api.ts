import axios, { AxiosError } from 'axios';
import type { ApiError } from '../types';

// In dev: set VITE_API_URL=http://localhost:5000 in frontend/.env
// In prod: set VITE_API_URL=https://your-app.onrender.com in Vercel dashboard
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Use this for /uploads/* paths so they resolve to the backend in production
export function resolveMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    if (data?.error) return data.error;
    if (data?.errors?.[0]?.msg) return data.errors[0].msg;
    if (data?.message) return data.message;
    if (error.message === 'Network Error') return 'Network error. Check your connection.';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export default api;
