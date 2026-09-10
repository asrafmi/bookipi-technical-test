import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RawErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  path?: string;
  timestamp?: string;
}

function extractErrorMessage(body: RawErrorBody | undefined, fallback: string): string {
  if (!body?.message) return fallback;
  if (Array.isArray(body.message)) return body.message.join(', ');
  return body.message;
}

export interface AuthRequestConfig extends InternalAxiosRequestConfig {
  requiresAuth?: boolean;
}

export type UnauthorizedHandler = () => void;

export interface HttpClientConfig {
  baseURL: string;
  getToken?: () => string | null;
  onUnauthorized?: UnauthorizedHandler;
}

export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const { baseURL } = config;

  const instance = axios.create({
    baseURL,
    headers: {
      Accept: 'application/json',
    },
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<RawErrorBody>) => {
      if (!error.response) {
        return Promise.reject(new ApiError('Network request failed. Check your connection and try again.', 0));
      }

      const { status, data } = error.response;

      return Promise.reject(
        new ApiError(extractErrorMessage(data, `Request failed with status ${status}`), status, data?.code),
      );
    },
  );

  return instance;
}
