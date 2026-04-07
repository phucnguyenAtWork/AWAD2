import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import type { RegisterPayload } from '../../services/auth';
import { financeService } from '../../services/finance';
import type { AccountPayload } from '../../services/types';

const VN_PHONE_RE = /^0[35789]\d{8}$/;

export function Signup() {
  const { register, isAuthed, token, onboarded, logout, markOnboarded } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterPayload>({ fullName: '', phone: '', email: '', password: '' });
  const [account, setAccount] = useState<AccountPayload>({ name: '', type: 'CASH', currency: 'VND', role: 'Student' });
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthed && !onboarded && step === 1) setStep(2);
    if (isAuthed && onboarded) {
      navigate('/', { replace: true });
    }
  }, [isAuthed, onboarded, navigate, step]);

  const handleChange = (key: keyof RegisterPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleAccountChange = (key: keyof AccountPayload) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAccount((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.phone || !form.password) {
      setError('Phone and password are required');
      return;
    }
    if (!VN_PHONE_RE.test(form.phone)) {
      setError('Phone must be a valid Vietnamese mobile number (10 digits starting with 03x, 05x, 07x, 08x, or 09x)');
      return;
    }

    setLoading(true);

    try {
      await register({
        phone: form.phone,
        password: form.password,
        fullName: form.fullName || undefined,
        email: form.email || undefined,
      });
      setAccount((prev) => ({
        ...prev,
        name: prev.name || `${form.fullName || 'Personal'} Wallet`,
      }));
      setStep(2);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      setLoading(false);
    }
  };

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('Session missing. Please sign in again.');
      return;
    }
    if (!account.name) {
      setError('Account name is required');
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

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {step === 1 ? 'Create account' : 'Create your first wallet'}
        </h2>
        {error && <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600 whitespace-pre-wrap">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="grid gap-3">
            <input
              type="text"
              placeholder="Full name"
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.fullName ?? ''}
              onChange={handleChange('fullName')}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.email ?? ''}
              onChange={handleChange('email')}
            />
            <input
              type="tel"
              placeholder="Phone number"
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.phone}
              onChange={handleChange('phone')}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.password}
              onChange={handleChange('password')}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`mt-2 rounded-xl py-2 text-sm font-semibold text-white ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {loading ? 'Creating user...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateAccount} className="grid gap-3">
            <input
              type="text"
              placeholder="Account name"
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={account.name}
              onChange={handleAccountChange('name')}
              required
            />
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={account.type}
              onChange={handleAccountChange('type')}
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="WALLET">Wallet</option>
              <option value="CREDIT">Credit</option>
            </select>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={account.currency ?? 'VND'}
              onChange={handleAccountChange('currency')}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={account.role ?? 'Student'}
              onChange={handleAccountChange('role')}
            >
              <option value="Student">Student</option>
              <option value="Worker">Worker</option>
              <option value="Freelancer">Freelancer</option>
              <option value="Parent">Parent</option>
              <option value="Retiree">Retiree</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className={`mt-2 rounded-xl py-2 text-sm font-semibold text-white ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {loading ? 'Creating account...' : 'Finish'}
            </button>
          </form>
        )}

        <div className="mt-2 text-xs text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
