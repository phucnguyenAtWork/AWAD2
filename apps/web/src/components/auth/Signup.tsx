import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { useAuth } from './AuthContext';
import type { RegisterPayload } from '../../services/auth';

const VN_PHONE_RE = /^0[35789]\d{8}$/;

export function Signup() {
  const { register, isAuthed, onboarded, onboardChecked } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterPayload>({ fullName: '', phone: '', email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed || !onboardChecked) return;
    navigate(onboarded ? '/' : '/onboarding', { replace: true });
  }, [isAuthed, onboarded, onboardChecked, navigate]);

  const handleChange = (key: keyof RegisterPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.phone) { setError('Phone number is required.'); return; }
    if (!VN_PHONE_RE.test(form.phone)) {
      setError('Phone must be a valid Vietnamese mobile number (10 digits starting with 03x, 05x, 07x, 08x, or 09x).');
      return;
    }
    if (!form.password) { setError('Password is required.'); return; }

    try {
      setLoading(true);
      await register({
        phone: form.phone,
        password: form.password,
        fullName: form.fullName || undefined,
        email: form.email || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-1 text-xl font-bold text-slate-900">Create account</h2>
        <p className="mb-5 text-sm text-slate-500">Sign up to get started</p>

        {error && <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600 whitespace-pre-wrap">{error}</div>}

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
            {loading ? 'Creating account...' : 'Continue'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
