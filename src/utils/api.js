const LOCAL_API_BASE_URL = 'http://localhost:8000';
const VERCEL_BACKEND_PREFIX = '/_/backend';

function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return LOCAL_API_BASE_URL;
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    return LOCAL_API_BASE_URL;
  }

  const isVercelPreview = hostname.endsWith('.vercel.app');
  if (isVercelPreview) {
    return VERCEL_BACKEND_PREFIX;
  }

  return LOCAL_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildApiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = String(path).startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function parseResponse(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      success: false,
      error: `Server returned a non-JSON response`,
      rawText
    };
  }
}

export async function requestJson(path, options = {}) {
  const {
    token,
    headers = {},
    body,
    timeoutMs = 15000,
    ...rest
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildApiUrl(path), {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(
        payload?.error || payload?.message || `Request failed with status ${response.status}`,
        response.status,
        payload
      );
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.', 408);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(error.message || `Unable to connect to the server at ${API_BASE_URL}.`);
  } finally {
    clearTimeout(timeout);
  }
}

export function getJson(path, options = {}) {
  return requestJson(path, { ...options, method: 'GET' });
}

export function postJson(path, body, options = {}) {
  return requestJson(path, { ...options, method: 'POST', body });
}

export function putJson(path, body, options = {}) {
  return requestJson(path, { ...options, method: 'PUT', body });
}

export function patchJson(path, body, options = {}) {
  return requestJson(path, { ...options, method: 'PATCH', body });
}

export function deleteJson(path, options = {}) {
  return requestJson(path, { ...options, method: 'DELETE' });
}
