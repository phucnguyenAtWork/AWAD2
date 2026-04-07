import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import { financeService } from '../../services/finance';
import type { AccountPayload } from '../../services/types';

export function Onboarding() {
  const { isAuthed, token, onboarded, logout, markOnboarded, user } = useAuth();
  const navigate = useNavigate();
  const defaultName = user?.fullName ? `${user.fullName}'s Wallet` : 'Personal Wallet';
  const [account, setAccount] = useState<AccountPayload>({ name: defaultName, type: 'CASH', currency: 'VND' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed) navigate('/login', { replace: true });
    if (isAuthed && onboarded) navigate('/', { replace: true });
  }, [isAuthed, onboarded, navigate]);

  useEffect(() => {
    if (user?.fullName && account.name === 'Personal Wallet') {
      setAccount((prev) => ({ ...prev, name: `${user.fullName}'s Wallet` }));
    }
  }, [user, account.name]);

  const handleAccountChange = (key: keyof AccountPayload) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAccount((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('Session missing. Please sign in again.');
      return;
    }
    if (!account.name) {
      setError('Wallet name is required');
      return;
    }
    setLoading(true);
    try {
      await financeService.createAccount(token, account, { onUnauthorized: logout });
      markOnboarded(true);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Account creation failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-colors';
  const selectClass = 'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-colors appearance-none';

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path d="M2.273 5.625A4.483 4.483 0 015.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 3H5.25a3 3 0 00-2.977 2.625zM2.273 8.625A4.483 4.483 0 015.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 6H5.25a3 3 0 00-2.977 2.625zM5.25 9a3 3 0 00-3 3v6a3 3 0 003 3h13.5a3 3 0 003-3v-6a3 3 0 00-3-3H15a.75.75 0 00-.75.75 2.25 2.25 0 01-4.5 0A.75.75 0 009 9H5.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Set up your wallet</h1>
          <p className="text-sm text-slate-500 mt-1">One last step to get you started</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5 px-1">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-900">Account</span>
          </div>
          <div className="flex-1 h-0.5 rounded bg-indigo-600" />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">2</div>
            <span className="text-xs font-medium text-slate-900">Wallet</span>
          </div>
        </div>

        <Card className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-600 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Wallet name</label>
              <input
                type="text"
                placeholder="e.g. Personal Wallet"
                className={inputClass}
                value={account.name}
                onChange={handleAccountChange('name')}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Type</label>
                <select
                  className={selectClass}
                  value={account.type}
                  onChange={handleAccountChange('type')}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                  <option value="WALLET">Wallet</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Currency</label>
                <select
                  className={selectClass}
                  value={account.currency ?? 'VND'}
                  onChange={handleAccountChange('currency')}
                >
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors ${
                loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              {loading ? 'Setting up...' : 'Get started'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
