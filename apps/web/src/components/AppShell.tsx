import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { TransactionsPage } from './transactions/TransactionsPage';
import { AuthProvider } from './auth/AuthContext';
import { Login } from './auth/Login';
import { Logout } from './auth/Logout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Signup } from './auth/Signup';
import { BudgetPage } from './budget/BudgetPage';
import { Dashboard } from './dashboard/Dashboard';
import SettingsPage from './settings/SettingPage';
import { ChatPage } from './insights/ChatPage';

type RequireOnboardedProps = {
  children: React.ReactElement;
};

const RequireOnboarded: React.FC<RequireOnboardedProps> = ({ children }) => children;

export function AppShell() {
  const authDisabled = import.meta.env.VITE_AUTH_DISABLED === '1';

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/logout" element={<Logout />} />

        <Route
          path="/"
          element={
            authDisabled ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : (
              <ProtectedRoute>
                <RequireOnboarded>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </RequireOnboarded>
              </ProtectedRoute>
            )
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Layout>
                <TransactionsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/budget"
          element={
            <ProtectedRoute>
              <Layout>
                <BudgetPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Layout>
                <ChatPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
