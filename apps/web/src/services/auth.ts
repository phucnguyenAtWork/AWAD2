import { request } from './http';
import type { AuthSession, AuthUser } from './types';

const AUTH_BASE = (import.meta.env.VITE_AUTH_API_URL ?? 'http://localhost:4002').replace(/\/+$/, '');

export type LoginPayload = {
  phone?: string;
  email?: string;
  password: string;
};

export type RegisterPayload = {
  phone: string;
  email?: string;
  password: string;
  fullName?: string;
};

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    return request<AuthSession, LoginPayload>(AUTH_BASE, '/auth/login', {
      method: 'POST',
      body: payload,
    });
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    return request<AuthSession, RegisterPayload>(AUTH_BASE, '/auth/register', {
      method: 'POST',
      body: payload,
    });
  },

  async me(token: string, options: { onUnauthorized?: () => void } = {}): Promise<AuthUser> {
    const response = await request<{ user: AuthUser }>(AUTH_BASE, '/auth/me', {
      token,
      ...options,
    });
    return response.user;
  },
};
