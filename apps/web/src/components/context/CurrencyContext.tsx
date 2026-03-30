import React, { createContext, useContext, useEffect, useState } from 'react';

export type SupportedCurrency = 'VND' | 'USD';

type CurrencyContextValue = {
  currency: SupportedCurrency;
  setCurrency: React.Dispatch<React.SetStateAction<SupportedCurrency>>;
  formatPrice: (amountInVnd: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const EXCHANGE_RATE = 25_000;

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<SupportedCurrency>(() => {
    const stored = localStorage.getItem('appCurrency');
    return stored === 'USD' ? 'USD' : 'VND';
  });

  useEffect(() => {
    localStorage.setItem('appCurrency', currency);
  }, [currency]);

  const formatPrice = (amountInVnd: number): string => {
    if (currency === 'USD') {
      const usdAmount = amountInVnd / EXCHANGE_RATE;
      return `$${usdAmount.toFixed(2)}`;
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amountInVnd);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextValue => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
