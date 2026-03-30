import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { financeService } from '../../services/finance';
import { useAuth } from '../auth/AuthContext';

export type SupportedCurrency = 'VND' | 'USD';

type CurrencyContextValue = {
  currency: SupportedCurrency;
  setCurrencyAndSync: (next: SupportedCurrency) => Promise<void>;
  formatPrice: (amountInVnd: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const EXCHANGE_RATE = 25_000;

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, logout } = useAuth();
  const [currency, setCurrency] = useState<SupportedCurrency>(() => {
    const stored = localStorage.getItem('appCurrency');
    return stored === 'USD' ? 'USD' : 'VND';
  });
  const [accountId, setAccountId] = useState<string | null>(null);

  // On login, fetch the user's first account and sync currency from DB
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void financeService
      .listAccounts(token, { onUnauthorized: logout })
      .then((accounts) => {
        if (cancelled || accounts.length === 0) return;
        const acct = accounts[0]!;
        setAccountId(acct.id);
        const dbCurrency: SupportedCurrency = acct.currency === 'USD' ? 'USD' : 'VND';
        setCurrency(dbCurrency);
        localStorage.setItem('appCurrency', dbCurrency);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, logout]);

  // When user changes currency: update DB + local state
  const setCurrencyAndSync = useCallback(async (next: SupportedCurrency) => {
    setCurrency(next);
    localStorage.setItem('appCurrency', next);
    if (token && accountId) {
      try {
        await financeService.updateAccount(token, accountId, { currency: next }, { onUnauthorized: logout });
      } catch (err) {
        console.warn('Failed to sync currency to backend', err);
      }
    }
  }, [token, accountId, logout]);

  const formatPrice = useCallback((amountInVnd: number): string => {
    if (currency === 'USD') {
      const usdAmount = amountInVnd / EXCHANGE_RATE;
      return `$${usdAmount.toFixed(2)}`;
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amountInVnd);
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrencyAndSync, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextValue => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
