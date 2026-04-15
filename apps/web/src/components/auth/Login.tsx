import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import type { LoginPayload } from '../../services/auth';

const VN_PHONE_RE = /^0[35789]\d{8}$/;

type LoginTab = 'phone' | 'email';

export function Login() {
  const { login, isAuthed, onboarded, onboardChecked } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<LoginTab>('phone');
  const [form, setForm] = useState<LoginPayload>({ phone: '', email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed || !onboardChecked) return;
    navigate(onboarded ? '/' : '/onboarding', { replace: true });
  }, [isAuthed, onboarded, onboardChecked, navigate]);

  const handleChange = (key: keyof LoginPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (tab === 'phone') {
      if (!form.phone) { setError('Phone number is required.'); return; }
      if (!VN_PHONE_RE.test(form.phone)) {
        setError('Phone must be a valid Vietnamese mobile number (10 digits starting with 03x, 05x, 07x, 08x, or 09x).');
        return;
      }
    } else {
      if (!form.email) { setError('Email is required.'); return; }
    }
    if (!form.password) { setError('Password is required.'); return; }

    try {
      setLoading(true);
      await login({
        phone: tab === 'phone' ? form.phone : undefined,
        email: tab === 'email' ? form.email : undefined,
        password: form.password,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const tabClass = (t: LoginTab) =>
    `flex-1 py-2 text-center text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-1 text-xl font-bold text-slate-900">Welcome back</h2>
        <p className="mb-5 text-sm text-slate-500">Sign in to your account</p>

        {/* Tab switcher */}
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          <button type="button" className={tabClass('phone')} onClick={() => setTab('phone')}>
            Phone
          </button>
          <button type="button" className={tabClass('email')} onClick={() => setTab('email')}>
            Email
          </button>
        </div>

        {error && <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</div>}

        <form onSubmit={handleSubmit} className="grid gap-3">
          {tab === 'phone' ? (
            <input
              type="tel"
              placeholder="Phone number"
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.phone ?? ''}
              onChange={handleChange('phone')}
            />
          ) : (
            <input
              type="email"
              placeholder="Email address"
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.email ?? ''}
              onChange={handleChange('email')}
            />
          )}
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
            className="mt-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="mt-2 text-center text-xs text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-600 hover:underline">
              Sign up
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
