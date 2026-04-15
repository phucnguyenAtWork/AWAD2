import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import { financeService } from '../../services/finance';
import type { AccountPayload, UserRole } from '../../services/types';

const ROLES: UserRole[] = ['Student', 'Worker', 'Freelancer', 'Parent', 'Retiree'];

export function Onboarding() {
  const { isAuthed, onboarded, onboardChecked, token, logout, markOnboarded } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountPayload>({ name: '', type: 'CASH', currency: 'VND', role: 'Student' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed) { navigate('/login', { replace: true }); return; }
    if (onboardChecked && onboarded) { navigate('/', { replace: true }); }
  }, [isAuthed, onboarded, onboardChecked, navigate]);

  const handleChange = (key: keyof AccountPayload) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAccount((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) { setError('Session missing. Please sign in again.'); return; }
    if (!account.name) { setError('Account name is required.'); return; }

    setLoading(true);
    try {
      await financeService.createAccount(token, account, { onUnauthorized: logout });
      markOnboarded(true);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Account creation failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-1 text-xl font-bold text-slate-900">Set up your wallet</h2>
        <p className="mb-5 text-sm text-slate-500">Create your first account to start tracking finances</p>

        {error && <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600 whitespace-pre-wrap">{error}</div>}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <input
            type="text"
            placeholder="Account name (e.g. My Wallet)"
            className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            value={account.name}
            onChange={handleChange('name')}
            required
          />

          {/* Role picker */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Your role</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setAccount((prev) => ({ ...prev, role }))}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    account.role === role
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={account.type}
              onChange={handleChange('type')}
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="WALLET">Wallet</option>
              <option value="CREDIT">Credit</option>
            </select>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={account.currency ?? 'VND'}
              onChange={handleChange('currency')}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 rounded-xl py-2 text-sm font-semibold text-white ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {loading ? 'Creating wallet...' : 'Get Started'}
          </button>
        </form>
      </Card>
    </div>
  );
}
