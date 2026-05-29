import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';

export type AuthMode = 'login' | 'setup';

export function useAuth(onUnauthorized?: () => void) {
  const [authToken, setAuthToken] = useState<string>(() => localStorage.getItem('auth_token') || '');
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const interceptorRef = useRef<{ req?: number; res?: number } | null>(null);
  const onUnauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    if (interceptorRef.current) return;
    const req = apiClient.interceptors.request.use((config) => {
      const t = localStorage.getItem('auth_token');
      if (t) {
        config.headers = config.headers || {};
        (config.headers as any).Authorization = `Bearer ${t}`;
      }
      return config;
    });
    const res = apiClient.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) {
          localStorage.removeItem('auth_token');
          setAuthToken('');
          setAuthUser(null);
          setAuthReady(true);
          onUnauthorizedRef.current?.();
        }
        return Promise.reject(err);
      }
    );
    interceptorRef.current = { req, res };
    return () => {
      try {
        if (interceptorRef.current?.req !== undefined) apiClient.interceptors.request.eject(interceptorRef.current.req);
        if (interceptorRef.current?.res !== undefined) apiClient.interceptors.response.eject(interceptorRef.current.res);
      } catch {
      } finally {
        interceptorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (authToken) localStorage.setItem('auth_token', authToken);
    else localStorage.removeItem('auth_token');
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setAuthUser(null);
      setAuthReady(true);
      return;
    }
    setAuthReady(false);
    apiClient.get('/api/auth/me').then((res) => {
      setAuthUser(res.data?.username || null);
      setAuthReady(true);
    }).catch(() => {
      setAuthToken('');
      setAuthUser(null);
      setAuthReady(true);
    });
  }, [authToken]);

  const submitAuth = async () => {
    const username = authUsername.trim();
    const password = authPassword;
    if (!username || !password) return;
    setAuthSubmitting(true);
    setAuthError('');
    try {
      if (authMode === 'setup') {
        try {
          await apiClient.post('/api/auth/setup', { username, password });
        } catch (e: any) {
          if (e?.response?.status === 409) {
            setAuthMode('login');
          } else {
            throw e;
          }
        }
      }
      const res = await apiClient.post('/api/auth/login', { username, password });
      setAuthToken(res.data?.token || '');
      setAuthUser(res.data?.username || username);
      setAuthReady(true);
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || '登录失败';
      if (e?.response?.status === 409) {
        setAuthMode('login');
        setAuthError('系统已初始化，请直接登录。');
      } else {
        setAuthError(String(msg));
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logoutAuth = () => {
    setAuthToken('');
    setAuthUser(null);
    setAuthReady(true);
  };

  return {
    authToken,
    authUser,
    authReady,
    authMode,
    authUsername,
    authPassword,
    authSubmitting,
    authError,
    setAuthMode,
    setAuthUsername,
    setAuthPassword,
    setAuthError,
    submitAuth,
    logoutAuth,
  };
}
