import axios from 'axios';
import { storage } from '../utils/storage';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function cleanMessage(msg = '') {
  return msg.replace(/^Value error, /, '').replace(/^String should/, 'Should');
}

/** Turn any Axios error into { status, message, fieldErrors, retryAfter }. */
export function normalizeError(error) {
  if (!error?.response) {
    return { status: 0, message: 'Cannot reach the server. Is the backend running?', fieldErrors: {} };
  }
  const { status, data, headers } = error.response;
  const fieldErrors = {};
  let message = 'Something went wrong. Please try again.';
  if (typeof data?.detail === 'string') {
    message = data.detail;
  } else if (Array.isArray(data?.detail)) {
    // FastAPI 422: [{loc: ['body', 'restaurant', 'name'], msg: '...'}]
    data.detail.forEach((d) => {
      const field = (d.loc || []).filter((p) => p !== 'body' && p !== 'query').join('.') || 'form';
      if (!fieldErrors[field]) fieldErrors[field] = cleanMessage(d.msg);
    });
    message = 'Please fix the highlighted fields.';
  }
  return { status, message, fieldErrors, retryAfter: headers?.['retry-after'] };
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    // Expired or invalid session → log out (but not for a failed login attempt).
    if (status === 401 && !url.includes('/auth/login') && storage.getToken()) {
      storage.clearAuth();
      if (unauthorizedHandler) unauthorizedHandler();
    }
    return Promise.reject(normalizeError(error));
  },
);

export const data = (promise) => promise.then((r) => r.data);

/** Drop empty values so they are not sent as query params. */
export function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
}
