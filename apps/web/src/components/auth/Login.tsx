import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import type { LoginPayload } from '../../services/auth';

const VN_PHONE_RE = /^0[35789]\d{8}$/;

export function Login() {
  const { login, isAuthed, onboarded } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginPayload>({ phone: '', email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthed && onboarded) {
      navigate('/');
    } else if (isAuthed && !onboarded) {
      navigate('/signup');
    }
  }, [isAuthed, navigate, onboarded]);

  const handleChange = (key: keyof LoginPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.phone && !form.email) {
      setError('Please enter either phone or email.');
      return;
    }
    if (form.phone && !VN_PHONE_RE.test(form.phone)) {
      setError('Phone must be a valid Vietnamese mobile number (10 digits starting with 03x, 05x, 07x, 08x, or 09x).');
      return;
    }
    if (!form.password) {
      setError('Password is required.');
      return;
    }

    try {
      setLoading(true);
      await login({
        phone: form.phone || undefined,
        email: form.email || undefined,
        password: form.password,
      });
      navigate(onboarded ? '/' : '/signup');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Login</h2>
        {error && <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</div>}
        <form onSubmit={handleSubmit} className="grid gap-3">
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
            value={form.phone ?? ''}
            onChange={handleChange('phone')}
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
            className="mt-2 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
              Remember me
            </label>
          </div>
          <div className="mt-2 text-xs text-gray-600">
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
