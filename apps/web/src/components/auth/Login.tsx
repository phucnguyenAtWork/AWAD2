import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import type { LoginPayload } from '../../services/auth';

const VN_PHONE_RE = /^0[35789]\d{8}$/;

type LoginMethod = 'phone' | 'email';

export function Login() {
  const { login, isAuthed, onboarded, onboardChecked } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [form, setForm] = useState<LoginPayload>({ phone: '', email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Redirect once auth + onboard check are both resolved
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

    if (method === 'phone') {
      if (!form.phone) { setError('Phone number is required.'); return; }
      if (!VN_PHONE_RE.test(form.phone)) {
        setError('Enter a valid Vietnamese mobile number (10 digits, starting with 03x/05x/07x/08x/09x).');
        return;
      }
    } else {
      if (!form.email) { setError('Email is required.'); return; }
    }
    if (!form.password) { setError('Password is required.'); return; }

    try {
      setLoading(true);
      await login({
        phone: method === 'phone' ? form.phone : undefined,
        email: method === 'email' ? form.email : undefined,
        password: form.password,
      });
      // Token is set → syncOnboarding fires → onboardChecked becomes true → useEffect navigates
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  const switchMethod = (m: LoginMethod) => {
    setMethod(m);
    setError('');
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-colors';

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path d="M2.273 5.625A4.483 4.483 0 015.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 3H5.25a3 3 0 00-2.977 2.625zM2.273 8.625A4.483 4.483 0 015.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 6H5.25a3 3 0 00-2.977 2.625zM5.25 9a3 3 0 00-3 3v6a3 3 0 003 3h13.5a3 3 0 003-3v-6a3 3 0 00-3-3H15a.75.75 0 00-.75.75 2.25 2.25 0 01-4.5 0A.75.75 0 009 9H5.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your finance account</p>
        </div>

        <Card className="p-6">
          <div className="flex rounded-lg bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => switchMethod('phone')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                method === 'phone'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Phone
            </button>
            <button
              type="button"
              onClick={() => switchMethod('email')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                method === 'email'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Email
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4">
            {method === 'phone' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone number</label>
                <input
                  type="tel"
                  placeholder="0912 345 678"
                  className={inputClass}
                  value={form.phone ?? ''}
                  onChange={handleChange('phone')}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className={inputClass}
                  value={form.email ?? ''}
                  onChange={handleChange('email')}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                className={inputClass}
                value={form.password}
                onChange={handleChange('password')}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-600">Remember me</span>
              </label>
              <button type="button" className="text-xs text-indigo-600 hover:underline">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors ${
                loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-indigo-600 hover:underline">
              Create one
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
