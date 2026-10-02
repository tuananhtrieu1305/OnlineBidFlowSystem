import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import client from '../../api/axiosClient';
import { currentUser, loginAccount, logoutAccount, type SessionUser } from './api/sessionApi';

type AuthContextValue = {
  user: SessionUser | null; loading: boolean; failure: string;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const generation = useRef(0);
  // Requests from an earlier login must not invalidate a newer authenticated session.
  const sessionEpoch = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    try {
      const next = await currentUser();
      if (version === generation.current) { setUser(next); setFailure(''); }
    } catch {
      if (version === generation.current) setFailure('Chưa thể kiểm tra phiên đăng nhập. Hãy kiểm tra kết nối và thử lại.');
    } finally { if (version === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    const requests = new WeakMap<object, number>();
    const requestInterceptor = client.interceptors.request.use(config => {
      requests.set(config, sessionEpoch.current);
      return config;
    });
    const interceptor = client.interceptors.response.use(response => response, error => {
      if (error.response?.status === 401 && requests.get(error.config) === sessionEpoch.current
          && !['/api/auth/login', '/api/auth/me'].includes(error.config?.url)) {
        ++generation.current; setUser(null); setFailure(''); setLoading(false);
      }
      return Promise.reject(error);
    });
    return () => { ++generation.current; clearInterval(timer); window.removeEventListener('focus', onFocus); client.interceptors.request.eject(requestInterceptor); client.interceptors.response.eject(interceptor); };
  }, [refresh]);
  async function login(username: string, password: string) {
    ++sessionEpoch.current;
    ++generation.current;
    const next = await loginAccount(username, password);
    ++generation.current; setUser(next); setLoading(false); setFailure('');
    return next;
  }
  async function logout() {
    ++sessionEpoch.current;
    ++generation.current;
    await logoutAccount();
    ++generation.current; setUser(null); setFailure(''); setLoading(false);
  }
  return <AuthContext.Provider value={{ user, loading, failure, refresh, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
