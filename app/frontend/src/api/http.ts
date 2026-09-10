import type { AxiosInstance } from 'axios';

import type { AuthRequestConfig } from './http-client';

interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

function toAxiosConfig(options: RequestOptions = {}): AuthRequestConfig {
  return {
    params: options.query,
    requiresAuth: options.auth,
  } as AuthRequestConfig;
}

export interface HttpMethods {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  del<T>(path: string, options?: RequestOptions): Promise<T>;
}

export function createHttpMethods(instance: AxiosInstance): HttpMethods {
  return {
    async get<T>(path: string, options?: RequestOptions): Promise<T> {
      const response = await instance.get<T>(path, toAxiosConfig(options));
      return response.data;
    },
    async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
      const response = await instance.post<T>(path, body, toAxiosConfig(options));
      return response.data;
    },
    async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
      const response = await instance.put<T>(path, body, toAxiosConfig(options));
      return response.data;
    },
    async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
      const response = await instance.patch<T>(path, body, toAxiosConfig(options));
      return response.data;
    },
    async del<T>(path: string, options?: RequestOptions): Promise<T> {
      const response = await instance.delete<T>(path, toAxiosConfig(options));
      return response.data;
    },
  };
}
