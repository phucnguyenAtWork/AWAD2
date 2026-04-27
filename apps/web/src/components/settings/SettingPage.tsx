import { useEffect, useMemo, useState } from 'react';
import { Card } from '../common/Card';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../auth/AuthContext';
import { financeService, type BudgetPreferences } from '../../services/finance';

type SplitKey = keyof BudgetPreferences;

const DEFAULT_SPLIT: BudgetPreferences = {
  needs_pct: 50,
  wants_pct: 30,
  savings_pct: 20,
};

const SPLIT_META: { key: SplitKey; label: string; accent: string; description: string }[] = [
  { key: 'needs_pct', label: 'Needs', accent: 'bg-emerald-500', description: 'Rent, bills, groceries, transport, essentials.' },
  { key: 'wants_pct', label: 'Wants', accent: 'bg-amber-500', description: 'Dining out, shopping, entertainment, optional spending.' },
  { key: 'savings_pct', label: 'Savings', accent: 'bg-indigo-500', description: 'Emergency fund, investing, future goals.' },
];

function rebalanceSplit(current: BudgetPreferences, key: SplitKey, nextValue: number): BudgetPreferences {
  const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
  const otherKeys = (Object.keys(current) as SplitKey[]).filter((item) => item !== key);
  const remaining = 100 - clamped;
  const otherTotal = otherKeys.reduce((sum, item) => sum + current[item], 0);

  if (otherTotal <= 0) {
    const even = Math.floor(remaining / otherKeys.length);
    const remainder = remaining - even * otherKeys.length;
    const firstOther = otherKeys[0] as SplitKey;
    const secondOther = otherKeys[1] as SplitKey;
    return {
      ...current,
      [key]: clamped,
      [firstOther]: even + remainder,
      [secondOther]: even,
    };
  }

  let assigned = 0;
  const updated: BudgetPreferences = { ...current, [key]: clamped };

  otherKeys.forEach((item, index) => {
    if (index === otherKeys.length - 1) {
      updated[item] = remaining - assigned;
      return;
    }

    const proportional = Math.round((current[item] / otherTotal) * remaining);
    updated[item] = proportional;
    assigned += proportional;
  });

  return updated;
}

export default function SettingsPage() {
  const { currency, setCurrencyAndSync } = useCurrency();
  const { token, user, refreshProfile, logout } = useAuth();
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    id: '',
  });
  const [loading, setLoading] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitSaving, setSplitSaving] = useState(false);
  const [split, setSplit] = useState<BudgetPreferences>(DEFAULT_SPLIT);
  const [splitStatus, setSplitStatus] = useState('');
  const [splitDirty, setSplitDirty] = useState(false);

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

  useEffect(() => {
    if (!token || !user?.id) return;
    setSplitLoading(true);
    setSplitStatus('');
    void financeService
      .getBudgetPreferences(token, user.id, { onUnauthorized: logout })
      .then((data) => {
        setSplit(data ?? DEFAULT_SPLIT);
        setSplitDirty(false);
      })
      .catch((err) => {
        setSplitStatus(err instanceof Error ? err.message : 'Failed to load budget split');
      })
      .finally(() => setSplitLoading(false));
  }, [logout, token, user?.id]);

  const total = split.needs_pct + split.wants_pct + split.savings_pct;

  const handleSplitChange = (key: SplitKey, value: number) => {
    setSplit((prev) => rebalanceSplit(prev, key, value));
    setSplitDirty(true);
    setSplitStatus('');
  };

  const handleSaveSplit = async () => {
    if (!token || !user?.id) return;
    setSplitSaving(true);
    setSplitStatus('');
    try {
      const saved = await financeService.saveBudgetPreferences(token, user.id, split, { onUnauthorized: logout });
      setSplit(saved);
      setSplitDirty(false);
      setSplitStatus('Budget split saved.');
    } catch (err) {
      setSplitStatus(err instanceof Error ? err.message : 'Failed to save budget split');
    } finally {
      setSplitSaving(false);
    }
  };

  const splitPreview = useMemo(
    () => [
      { label: 'Needs', value: split.needs_pct, accent: 'bg-emerald-500' },
      { label: 'Wants', value: split.wants_pct, accent: 'bg-amber-500' },
      { label: 'Savings', value: split.savings_pct, accent: 'bg-indigo-500' },
    ],
    [split],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
          <p className="text-sm text-slate-500">Manage your account and planning preferences</p>
        </div>
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base font-semibold text-slate-900">Account Information</h3>
          <span className="text-xs font-mono text-slate-400">ID: {profile.id || '#'}</span>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              value={loading ? 'Loading...' : profile.full_name}
              disabled
              className="block w-full rounded-lg border-slate-200 bg-slate-50 py-2.5 px-3 text-slate-900 shadow-sm sm:text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Phone Number</label>
            <input
              type="text"
              value={loading ? '...' : profile.phone}
              disabled
              className="block w-full rounded-lg border-slate-200 bg-slate-50 py-2.5 px-3 text-slate-900 shadow-sm sm:text-sm"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              value={loading ? '...' : profile.email}
              disabled
              className="block w-full rounded-lg border-slate-200 bg-slate-50 py-2.5 px-3 text-slate-900 shadow-sm sm:text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Contact support to update your personal details.</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Regional & Currency</h3>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Display Currency</label>
              <p className="text-xs text-slate-500 max-w-md">
                This controls how prices are displayed across your dashboard and how the AI quotes estimates.
              </p>
            </div>

            <select
              value={currency}
              onChange={(e) => {
                const next = e.target.value === 'USD' ? 'USD' : 'VND';
                void setCurrencyAndSync(next);
              }}
              className="block w-full sm:w-40 rounded-lg border-slate-200 bg-slate-50 py-2 pl-3 pr-10 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="VND">VND (₫)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          {currency === 'USD' && (
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-100">
              <h3 className="text-sm font-medium text-blue-800">Currency Conversion Active</h3>
              <p className="mt-2 text-sm text-blue-700">
                The app converts estimates using a fixed rate of <strong>25,000 VND = $1 USD</strong>. Transactions are still recorded in VND.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Budget Split</h3>
            <p className="text-sm text-slate-500">Adjust how your income should be split between needs, wants, and savings.</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Total</div>
            <div className={`text-lg font-semibold ${total === 100 ? 'text-slate-900' : 'text-rose-600'}`}>{total}%</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="overflow-hidden rounded-full bg-slate-100 h-4">
            <div className="flex h-full w-full">
              {splitPreview.map((item) => (
                <div key={item.label} className={item.accent} style={{ width: `${item.value}%` }} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {splitPreview.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="text-lg font-semibold text-slate-900">{item.value}%</span>
                </div>
              </div>
            ))}
          </div>

          {splitLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Loading budget split...</div>
          ) : (
            <div className="space-y-5">
              {SPLIT_META.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.accent}`} />
                        <h4 className="font-semibold text-slate-900">{item.label}</h4>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                    </div>
                    <div className="text-xl font-semibold text-slate-900">{split[item.key]}%</div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={split[item.key]}
                    onChange={(e) => handleSplitChange(item.key, Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">Current plan</div>
              <div className="text-sm text-slate-500">
                {split.needs_pct}/{split.wants_pct}/{split.savings_pct} split
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveSplit()}
              disabled={splitSaving || splitLoading || total !== 100 || !splitDirty}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-indigo-300 hover:bg-indigo-700"
            >
              {splitSaving ? 'Saving...' : 'Save Split'}
            </button>
          </div>

          {splitStatus && (
            <div className={`rounded-lg px-4 py-3 text-sm ${splitStatus === 'Budget split saved.' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {splitStatus}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
