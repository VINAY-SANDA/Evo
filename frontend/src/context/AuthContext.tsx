import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import {
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  saveAuthSession,
  updateStoredUser,
} from '../services/authStorage';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (passcode: string, email?: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getAuthToken());
  });

  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const [isLoading] = useState<boolean>(false);

  useEffect(() => {
    const verifySession = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiBase = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : isLocalhost ? 'http://localhost:5000' : '';

      if (!apiBase) return;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${apiBase}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) {
          clearAuthSession();
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        if (!response.ok) return;
        const data = await response.json() as { authenticated: boolean; user: User };
        if (!data.authenticated || !data.user) return;
        updateStoredUser(data.user);
        setUser(data.user);
        setIsAuthenticated(true);
      } catch {
        // Keep the cached session available during network outages or backend wake-up.
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void verifySession();
  }, []);

  const login = async (
    passcode: string,
    email: string = 'vinay@example.com',
    rememberMe: boolean = true,
  ): Promise<{ success: boolean; error?: string }> => {
    const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const apiBase = rawApiUrl
      ? rawApiUrl.replace(/\/+$/, '')
      : isLocalhost
      ? 'http://localhost:5000'
      : '';

    if (!apiBase) {
      return { success: false, error: 'EVO could not reach its server. Check the app configuration and try again.' };
    }

    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Authentication rejected' };
      }

      saveAuthSession(data.token, data.user, rememberMe);
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return { success: false, error: 'EVO could not reach its server. Check your connection and try again.' };
    }
  };

  const logout = () => {
    clearAuthSession();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
