// main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { AppShell } from './components/AppShell';
import { CurrencyProvider } from './components/context/CurrencyContext';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <CurrencyProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </CurrencyProvider>
  </React.StrictMode>,
);
