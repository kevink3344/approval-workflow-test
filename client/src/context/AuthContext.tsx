import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { User, LoginPayload, RegisterPayload, AuthResponse } from '../types';
import apiClient from '../api/client';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  loginSelect: (userId: string) => Promise<void>;
  loginPassword: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    if (token) {
      apiClient
        .get<{ user: User }>('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const doLogin = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await apiClient.post<AuthResponse>('/auth/login-with-password', payload);
    doLogin(res.data.token, res.data.user);
  }, [doLogin]);

  const loginSelect = useCallback(async (userId: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { userId });
    doLogin(res.data.token, res.data.user);
  }, [doLogin]);

  const loginPassword = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login-with-password', { email, password });
    doLogin(res.data.token, res.data.user);
  }, [doLogin]);

  const registerUser = useCallback(async (payload: RegisterPayload) => {
    const res = await apiClient.post<AuthResponse>('/auth/register', payload);
    const { token: newToken, user: newUser } = res.data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    loginSelect,
    loginPassword,
    register: registerUser,
    logout,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}