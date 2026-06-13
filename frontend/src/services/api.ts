import axios from 'axios';
import type { ApiError } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60000,
});

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
