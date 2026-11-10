import { createContext, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { homePathFor } from '../utils/constants';
import { storage, USER_KEY } from '../utils/storage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => storage.getToken());
  const [user, setUser] = useState(() => (storage.getToken() ? storage.getUser() : null));
  const [loading, setLoading] = useState(() => Boolean(storage.getToken()));
  // Why the user was logged out: 'manual' (Log out button) or 'expired' (the API rejected the token).
  const [logoutReason, setLogoutReason] = useState(null);

  // Restore the session: confirm the stored token is still valid.
  useEffect(() => {
    let cancelled = false;
    if (!storage.getToken()) {
      setLoading(false);
      return undefined;
    }
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        storage.setUser(me);
      })
      .catch((err) => {
        if (cancelled) return;
        // Only a rejected token (401) or a disabled account (403) ends the session. A network error
        // or a 5xx (backend restarting, flaky Wi-Fi) keeps the stored session; pages show their own errors.
        if (err?.status !== 401 && err?.status !== 403) return;
        storage.clearAuth();
        setToken(null);
        setUser(null);
        if (err.status === 401) setLogoutReason('expired');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Tabs share localStorage, so a login/logout in another tab replaces this tab's token too.
  // Follow that change instead of showing one user while sending another user's token.
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== USER_KEY && event.key !== null) return; // null = storage.clear()
      const nextToken = storage.getToken();
      const nextUser = nextToken ? storage.getUser() : null;
      if (nextUser?.id === currentUserId.current) return;
      // One transition: the new user and the new page render together, so route guards
      // never see the new user on the old page (which would bounce to /unauthorized).
      startTransition(() => {
        setToken(nextToken);
        setUser(nextUser);
        navigate(nextUser ? homePathFor(nextUser.role) : '/login', { replace: true });
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [navigate]);

  // Any 401 from the API (expired token) logs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Remember the page, so logging in again returns there.
      const from = { pathname: window.location.pathname, search: window.location.search };
      setLogoutReason('expired');
      setToken(null);
      setUser(null);
      navigate('/login?expired=1', { replace: true, state: { from } });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  const startSession = useCallback((result) => {
    storage.setAuth(result.access_token, result.user);
    setLogoutReason(null);
    setToken(result.access_token);
    setUser(result.user);
    return result.user;
  }, []);

  const login = useCallback(async (email, password) => startSession(await authApi.login(email, password)), [startSession]);
  const registerCustomer = useCallback(async (p) => startSession(await authApi.registerCustomer(p)), [startSession]);
  const registerOwner = useCallback(async (p) => startSession(await authApi.registerOwner(p)), [startSession]);
  const registerDeliveryPartner = useCallback(
    async (p) => startSession(await authApi.registerDeliveryPartner(p)),
    [startSession],
  );

  const logout = useCallback(() => {
    storage.clearAuth();
    setLogoutReason('manual');   // a deliberate logout: the next login starts from the role's home page
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
      homePath: homePathFor(user?.role),
      logoutReason,
      login,
      registerCustomer,
      registerOwner,
      registerDeliveryPartner,
      logout,
    }),
    [user, token, loading, logoutReason, login, registerCustomer, registerOwner, registerDeliveryPartner, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
