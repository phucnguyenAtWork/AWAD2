import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService, type LoginPayload, type RegisterPayload } from '../../services/auth';
import { financeService } from '../../services/finance';
import type { AuthSession, AuthUser } from '../../services/types';

export type CardInfo = {
  last4: string;
  name: string;
};

type AuthContextValue = {
  token: string;
  user: AuthUser | null;
  card: CardInfo | null;
  onboarded: boolean;
  onboardChecked: boolean;
  isAuthed: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  markOnboarded: (value: boolean) => void;
  completeOnboarding: (info: CardInfo) => void;
  refreshProfile: () => Promise<void>;
};

const STORAGE_TOKEN_KEY = 'accessToken';
const STORAGE_USER_KEY = 'user';
const STORAGE_ONBOARDED_KEY = 'onboarded';
const STORAGE_CARD_KEY = 'card';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseAuthUser = (raw: string | null): AuthUser | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.phone === 'string') {
      return {
        id: parsed.id,
        phone: parsed.phone,
        email: typeof parsed.email === 'string' ? parsed.email : null,
        fullName: typeof parsed.fullName === 'string' ? parsed.fullName : null,
        createdAt: parsed.createdAt ?? new Date().toISOString(),
      };
    }
  } catch (err) {
    // ignore parsing errors, return null
  }
  return null;
};

const parseCardInfo = (raw: string | null): CardInfo | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.last4 === 'string' && typeof parsed.name === 'string') {
      return { last4: parsed.last4, name: parsed.name };
    }
  } catch (err) {
    // ignore parsing errors
  }
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem(STORAGE_TOKEN_KEY) ?? '');
  const [user, setUser] = useState<AuthUser | null>(() => parseAuthUser(localStorage.getItem(STORAGE_USER_KEY)));
  const [onboarded, setOnboarded] = useState<boolean>(() => localStorage.getItem(STORAGE_ONBOARDED_KEY) === 'true');
  const [onboardChecked, setOnboardChecked] = useState<boolean>(false);
  const [card, setCard] = useState<CardInfo | null>(() => parseCardInfo(localStorage.getItem(STORAGE_CARD_KEY)));

  const setSession = useCallback((session: AuthSession) => {
    setToken(session.accessToken);
    setUser(session.user);
    localStorage.setItem(STORAGE_TOKEN_KEY, session.accessToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(session.user));
  }, []);

  const markOnboarded = useCallback((value: boolean) => {
    setOnboarded(value);
    localStorage.setItem(STORAGE_ONBOARDED_KEY, value ? 'true' : 'false');
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await authService.login(payload);
      setSession(session);
    },
    [setSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const session = await authService.register(payload);
      setSession(session);
    },
    [setSession],
  );

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
    setOnboarded(false);
    setOnboardChecked(false);
    setCard(null);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_ONBOARDED_KEY);
    localStorage.removeItem(STORAGE_CARD_KEY);
  }, []);

  const completeOnboarding = useCallback((info: CardInfo) => {
    setCard(info);
    markOnboarded(true);
    setOnboardChecked(true);
    localStorage.setItem(STORAGE_CARD_KEY, JSON.stringify(info));
  }, [markOnboarded]);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const profile = await authService.me(token, { onUnauthorized: logout });
    setUser(profile);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(profile));
  }, [logout, token]);

  useEffect(() => {
    if (!token) {
      setOnboardChecked(true);
      return;
    }
    let cancelled = false;
    const syncOnboarding = async () => {
      try {
        const accounts = await financeService.listAccounts(token, { onUnauthorized: logout });
        if (cancelled) return;
        const hasAccount = accounts.length > 0;
        markOnboarded(hasAccount);
      } catch (err) {
        console.warn('Onboarding sync failed', err);
      } finally {
        if (!cancelled) setOnboardChecked(true);
      }
    };
    void syncOnboarding();
    return () => {
      cancelled = true;
    };
  }, [logout, markOnboarded, token]);

  useEffect(() => {
    if (token && !user) {
      void refreshProfile();
    }
  }, [token, user, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      card,
      onboarded,
      onboardChecked,
      isAuthed: Boolean(token),
      login,
      register,
      logout,
      markOnboarded,
      completeOnboarding,
      refreshProfile,
    }),
    [card, completeOnboarding, login, logout, markOnboarded, onboardChecked, onboarded, refreshProfile, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
