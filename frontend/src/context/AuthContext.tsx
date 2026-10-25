import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (passcode: string, email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'evo_auth_token';
const USER_KEY = 'evo_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  }, []);

  const login = async (passcode: string, email: string = 'vinay@example.com'): Promise<{ success: boolean; error?: string }> => {
    const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const apiBase = rawApiUrl
      ? rawApiUrl.replace(/\/+$/, '')
      : isLocalhost
      ? 'http://localhost:5000'
      : '';

    try {
      if (apiBase) {
        const res = await fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode, email }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Authentication rejected' };
        }

        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
        setIsAuthenticated(true);
        return { success: true };
      }
    } catch {
      // If network is completely offline, allow secure fallback check for Vinay
    }

    // Local validation fallback
    if (passcode === 'Vinay@2026' || passcode === '2026') {
      const fallbackUser: User = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Vinay',
        email: 'vinay@example.com',
        timezone: 'Asia/Kolkata',
        aiTone: 'rigorous',
      };
      localStorage.setItem(TOKEN_KEY, 'evo_sec_local_vinay');
      localStorage.setItem(USER_KEY, JSON.stringify(fallbackUser));
      setUser(fallbackUser);
      setIsAuthenticated(true);
      return { success: true };
    }

    return {
      success: false,
      error: 'Access denied: Passcode incorrect. Only Vinay is authorized to access this personal operating system.',
    };
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
