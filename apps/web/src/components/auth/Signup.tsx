import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import type { RegisterPayload } from '../../services/auth';

const VN_PHONE_RE = /^0[35789]\d{8}$/;

export function Signup() {
  const { register, isAuthed, onboarded } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterPayload>({ fullName: '', phone: '', email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthed && !onboarded) navigate('/onboarding', { replace: true });
    if (isAuthed && onboarded) navigate('/', { replace: true });
  }, [isAuthed, onboarded, navigate]);

  const handleChange = (key: keyof RegisterPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.phone || !form.password) {
      setError('Phone and password are required');
      return;
    }
    if (!VN_PHONE_RE.test(form.phone)) {
      setError('Enter a valid Vietnamese mobile number (10 digits, starting with 03x/05x/07x/08x/09x).');
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
      // After register, useEffect will redirect to /onboarding
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">Start managing your finances smarter</p>
        </div>

        <Card className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-600 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                placeholder="Nguyen Van A"
                className={inputClass}
                value={form.fullName ?? ''}
                onChange={handleChange('fullName')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email <span className="text-slate-400">(optional)</span></label>
              <input
                type="email"
                placeholder="you@example.com"
                className={inputClass}
                value={form.email ?? ''}
                onChange={handleChange('email')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone number</label>
              <input
                type="tel"
                placeholder="0912 345 678"
                className={inputClass}
                value={form.phone}
                onChange={handleChange('phone')}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Create a password"
                className={inputClass}
                value={form.password}
                onChange={handleChange('password')}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`mt-1 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors ${
                loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              {loading ? 'Creating...' : 'Continue'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:underline">
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
