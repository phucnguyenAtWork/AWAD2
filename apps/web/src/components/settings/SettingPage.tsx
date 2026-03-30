import { useEffect, useState } from 'react';
import { Card } from '../common/Card';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../auth/AuthContext';

export default function SettingsPage() {
  const { currency, setCurrency } = useCurrency();
  const { token, user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    id: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    void refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile, token]);

  useEffect(() => {
    if (!user) return;
    setProfile({
      full_name: user.fullName || 'User',
      email: user.email || '',
      phone: user.phone || '',
      id: user.id || '',
    });
  }, [user]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
          <p className="text-sm text-slate-500">Manage your account and preferences</p>
        </div>
      </div>

      {/* CARD 1: ACCOUNT INFORMATION (Backend Data) */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base font-semibold text-slate-900">Account Information</h3>
          <span className="text-xs font-mono text-slate-400">ID: {profile.id || '#'}</span>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Full Name</label>
            <div className="relative">
              <input 
                type="text" 
                value={loading ? 'Loading...' : profile.full_name}
                disabled
                className="block w-full rounded-lg border-slate-200 bg-slate-50 py-2.5 px-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Phone Number</label>
            <div className="relative">
              <input 
                type="text" 
                value={loading ? '...' : profile.phone}
                disabled
                className="block w-full rounded-lg border-slate-200 bg-slate-50 py-2.5 px-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Email Address</label>
            <div className="relative">
              <input 
                type="email" 
                value={loading ? '...' : profile.email}
                disabled
                className="block w-full rounded-lg border-slate-200 bg-slate-50 py-2.5 px-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Contact support to update your personal details.</p>
          </div>
        </div>
      </Card>

      {/* CARD 2: SYSTEM PREFERENCES (Local Context Data) */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Regional & Currency</h3>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Display Currency</label>
              <p className="text-xs text-slate-500 max-w-md">
                This controls how prices are displayed across your Dashboard and how the AI Assistant quotes estimates.
              </p>
            </div>
            
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => {
                  const next = e.target.value === 'USD' ? 'USD' : 'VND';
                  setCurrency(next);
                }}
                className="block w-full sm:w-40 rounded-lg border-slate-200 bg-slate-50 py-2 pl-3 pr-10 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 transition-shadow cursor-pointer"
              >
                <option value="VND">VND (₫)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          {/* USD Warning */}
          {currency === 'USD' && (
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-100 animate-in slide-in-from-top-2 duration-300">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Currency Conversion Active</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      The AI will convert all estimates using a fixed rate of <strong>25,000 VND = $1 USD</strong>. 
                      Please note that actual transactions are still recorded in VND.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
