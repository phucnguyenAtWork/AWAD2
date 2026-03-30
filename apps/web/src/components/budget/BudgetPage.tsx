import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../common/Card';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { financeService, type BudgetDraft } from '../../services/finance';
import type { Account, Budget, Category, Transaction } from '../../services/types';

type BudgetForm = {
  id?: string;
  accountId: string;
  categoryId: string | null;
  amountLimit: number | '';
  alertThreshold: number;
  period: 'MONTHLY' | 'WEEKLY';
  startDate: string;
  endDate: string;
};

export function BudgetPage() {
  const { token, logout } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const currencySymbol = currency === 'USD' ? '$' : '₫';
  const [items, setItems] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Budget | null>(null);
  const [formData, setFormData] = useState<BudgetForm | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [budgetData, accountData, categoryData, txData] = await Promise.all([
        financeService.listBudgets(token, { onUnauthorized: logout }),
        financeService.listAccounts(token, { onUnauthorized: logout }),
        financeService.listCategories(token, undefined, { onUnauthorized: logout }),
        financeService.listTransactions(token, { onUnauthorized: logout }),
      ]);
      setItems(budgetData);
      setAccounts(accountData);
      setTransactions(txData);
      const seenNames = new Set<string>();
      const deduped: Category[] = [];
      for (const c of categoryData) {
        const key = c.name.trim().toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        deduped.push(c);
      }
      setCategories(deduped);
    } finally {
      setLoading(false);
    }
  }, [logout, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Compute actual spent per budget from transactions
  const spentByBudget = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of items) {
      const start = new Date(b.startDate).getTime();
      const end = new Date(b.endDate).getTime() + 86400000; // inclusive end
      // Find all category IDs that match this budget's category (by name, across accounts)
      const budgetCatName = b.categoryName?.toLowerCase();
      const matchingCategoryIds = new Set<string>();
      if (b.categoryId) {
        // Specific category budget — match all categories with same name
        for (const c of categories) {
          if (c.name.trim().toLowerCase() === budgetCatName) matchingCategoryIds.add(c.id);
        }
        // Also include the exact categoryId
        matchingCategoryIds.add(b.categoryId);
      }

      let spent = 0;
      for (const tx of transactions) {
        if (tx.type !== 'EXPENSE') continue;
        const txTime = new Date(tx.occurredAt).getTime();
        if (txTime < start || txTime >= end) continue;
        if (b.categoryId) {
          // Category-specific budget: only count matching category
          if (!matchingCategoryIds.has(tx.categoryId ?? '')) continue;
        }
        // Overall budget (no categoryId): count all expenses
        spent += tx.amount;
      }
      map.set(b.id, spent);
    }
    return map;
  }, [items, transactions, categories]);

  const openModal = (budget?: Budget) => {
    const defaultAccount = accounts[0]?.id ?? '';
    setEditingItem(budget ?? null);
    setFormData({
      id: budget?.id,
      accountId: budget?.accountId ?? defaultAccount,
      categoryId: budget?.categoryId ?? null,
      amountLimit: budget ? budget.amountLimit : '',
      alertThreshold: Math.round((budget?.alertThreshold ?? 0.8) * 100),
      period: budget?.period ?? 'MONTHLY',
      startDate: budget?.startDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      endDate:
        budget?.endDate.slice(0, 10) ??
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    await financeService.deleteBudget(token, id, { onUnauthorized: logout });
    setDeleteConfirmId(null);
    void loadData();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !formData) return;
    const payload: BudgetDraft = {
      accountId: formData.accountId,
      categoryId: formData.categoryId,
      amountLimit: Number(formData.amountLimit),
      alertThreshold: formData.alertThreshold / 100,
      period: formData.period,
      startDate: formData.startDate,
      endDate: formData.endDate,
    };

    if (editingItem) {
      await financeService.updateBudget(token, editingItem.id, payload, { onUnauthorized: logout });
    } else {
      await financeService.createBudget(token, payload, { onUnauthorized: logout });
    }
    setIsModalOpen(false);
    void loadData();
  };

  // Classify each budget by status using its alertThreshold
  const budgetStatus = useMemo(() => {
    const map = new Map<string, 'healthy' | 'at-risk' | 'over'>();
    for (const b of items) {
      const spent = spentByBudget.get(b.id) ?? 0;
      const pct = b.amountLimit > 0 ? spent / b.amountLimit : 0;
      if (pct >= 1) map.set(b.id, 'over');
      else if (pct >= b.alertThreshold) map.set(b.id, 'at-risk');
      else map.set(b.id, 'healthy');
    }
    return map;
  }, [items, spentByBudget]);

  // Sort: over-budget first, then at-risk, then healthy
  const sortedItems = useMemo(() => {
    const order = { 'over': 0, 'at-risk': 1, 'healthy': 2 };
    return [...items].sort((a, b) => {
      const sa = order[budgetStatus.get(a.id) ?? 'healthy'];
      const sb = order[budgetStatus.get(b.id) ?? 'healthy'];
      return sa - sb;
    });
  }, [items, budgetStatus]);

  const totals = useMemo(() => {
    const limit = items.reduce((sum, b) => sum + b.amountLimit, 0);
    const spent = items.reduce((sum, b) => sum + (spentByBudget.get(b.id) ?? 0), 0);
    let overCount = 0;
    let atRiskCount = 0;
    for (const [, status] of budgetStatus) {
      if (status === 'over') overCount++;
      else if (status === 'at-risk') atRiskCount++;
    }
    return { limit, spent, remaining: limit - spent, percent: limit > 0 ? (spent / limit) * 100 : 0, overCount, atRiskCount };
  }, [items, spentByBudget, budgetStatus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Budgets</h2>
          <p className="text-slate-500 text-sm">Manage spending limits per account or category</p>
        </div>
        <button
          onClick={() => openModal()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Create Budget
        </button>
      </div>

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Limit</p>
            <p className="text-2xl font-bold text-slate-900">{formatPrice(totals.limit)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tracked Spend</p>
            <p className="text-2xl font-bold text-indigo-600">{formatPrice(totals.spent)}</p>
          </Card>
          <Card className={`p-5 ${totals.remaining < 0 ? 'bg-rose-50' : ''}`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Remaining</p>
            <p className={`text-2xl font-bold ${totals.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatPrice(totals.remaining)}
            </p>
          </Card>
          <Card className={`p-5 ${(totals.overCount + totals.atRiskCount) > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Budget Health</p>
            {(totals.overCount + totals.atRiskCount) === 0 ? (
              <p className="text-2xl font-bold text-emerald-600">All Good</p>
            ) : (
              <div className="flex items-baseline gap-3">
                {totals.overCount > 0 && (
                  <span className="text-2xl font-bold text-rose-600">{totals.overCount} <span className="text-sm font-medium">over</span></span>
                )}
                {totals.atRiskCount > 0 && (
                  <span className="text-2xl font-bold text-amber-600">{totals.atRiskCount} <span className="text-sm font-medium">at risk</span></span>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-white p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-500 shrink-0">{items.length} budgets</span>
        </div>

        <div className="overflow-x-auto bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Account</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Category</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide" style={{ minWidth: 220 }}>Progress</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Period</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Dates</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    No budgets yet
                  </td>
                </tr>
              ) : (
                sortedItems.map((b) => {
                  const isConfirming = deleteConfirmId === b.id;
                  const spent = spentByBudget.get(b.id) ?? 0;
                  const rawPct = b.amountLimit > 0 ? (spent / b.amountLimit) * 100 : 0;
                  const barPct = Math.min(rawPct, 100);
                  const status = budgetStatus.get(b.id) ?? 'healthy';
                  const thresholdPct = b.alertThreshold * 100;
                  const barColor = status === 'over' ? 'bg-rose-500' : status === 'at-risk' ? 'bg-amber-500' : 'bg-indigo-500';
                  const rowBg = status === 'over' ? 'bg-rose-50/40' : status === 'at-risk' ? 'bg-amber-50/40' : '';
                  return (
                    <tr key={b.id} className={`group hover:bg-slate-50/80 transition-colors ${rowBg}`}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{b.accountName ?? 'Account'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {b.categoryName ?? 'Overall'}
                          </span>
                          {status === 'over' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.008v.008H12v-.008z" /></svg>
                              Over
                            </span>
                          )}
                          {status === 'at-risk' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              At Risk
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4" style={{ minWidth: 220 }}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className={`font-bold ${status === 'over' ? 'text-rose-600' : status === 'at-risk' ? 'text-amber-600' : 'text-slate-700'}`}>
                            {formatPrice(spent)}
                          </span>
                          <span className="text-slate-400">/ {formatPrice(b.amountLimit)}</span>
                        </div>
                        {/* Progress bar with threshold marker */}
                        <div className="relative w-full h-2.5 rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${barPct}%` }}
                          />
                          {/* Threshold marker line */}
                          <div
                            className="absolute top-0 h-full w-0.5 bg-slate-400/70"
                            style={{ left: `${thresholdPct}%` }}
                            title={`Alert threshold: ${Math.round(thresholdPct)}%`}
                          >
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 whitespace-nowrap font-medium">
                              {Math.round(thresholdPct)}%
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-slate-400">
                            {rawPct > 100 ? `${Math.round(rawPct)}% used` : `${Math.round(barPct)}% used`}
                          </span>
                          {status === 'healthy' && (
                            <span className="text-[10px] text-slate-400">
                              {formatPrice(b.amountLimit - spent)} left
                            </span>
                          )}
                          {status === 'over' && (
                            <span className="text-[10px] font-semibold text-rose-500">
                              {formatPrice(spent - b.amountLimit)} over
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">{b.period}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {b.startDate.slice(0, 10)} → {b.endDate.slice(0, 10)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isConfirming ? (
                          <div className="flex justify-end items-center gap-2">
                            <span className="text-xs text-slate-500">Delete?</span>
                            <button onClick={() => handleDelete(b.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800">Yes</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">No</button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openModal(b)} className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded hover:bg-indigo-50">
                              Edit
                            </button>
                            <button onClick={() => setDeleteConfirmId(b.id)} className="text-rose-600 hover:text-rose-800 p-1.5 rounded hover:bg-rose-50">
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && formData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">{editingItem ? 'Edit Budget' : 'Create Budget'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={formData.accountId}
                  onChange={(e) => setFormData((prev) => prev ? { ...prev, accountId: e.target.value, categoryId: null } : prev)}
                  required
                >
                  <option value="" disabled>Select an account...</option>
                  {accounts.map((acct) => (
                    <option key={acct.id} value={acct.id}>{acct.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={formData.categoryId ?? ''}
                  onChange={(e) => setFormData((prev) => prev ? { ...prev, categoryId: e.target.value || null } : prev)}
                >
                  <option value="">Overall (all categories)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Spending Limit</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">{currencySymbol}</span>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-300 pl-7 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={formData.amountLimit}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, amountLimit: Number(e.target.value) } : prev)}
                    required
                    placeholder="5000000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Warning Threshold</label>
                {/* Visual preview bar */}
                <div className="relative w-full h-7 rounded-lg bg-slate-100 mb-3 overflow-hidden">
                  {/* Safe zone */}
                  <div
                    className="absolute inset-y-0 left-0 bg-indigo-100 transition-all duration-200"
                    style={{ width: `${formData.alertThreshold}%` }}
                  />
                  {/* Warning zone */}
                  <div
                    className="absolute inset-y-0 bg-amber-100 transition-all duration-200"
                    style={{ left: `${formData.alertThreshold}%`, right: '0%' }}
                  />
                  {/* Threshold line */}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-amber-500 transition-all duration-200 z-10"
                    style={{ left: `${formData.alertThreshold}%` }}
                  />
                  {/* Labels inside the bar */}
                  <div className="absolute inset-0 flex items-center text-[10px] font-semibold uppercase tracking-wider px-2">
                    <span className="text-indigo-500 flex-1 text-center">Safe</span>
                    <span className="text-amber-600 flex-1 text-center">Warning</span>
                  </div>
                </div>
                {/* Slider */}
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={formData.alertThreshold}
                  onChange={(e) => setFormData((prev) => prev ? { ...prev, alertThreshold: Number(e.target.value) } : prev)}
                  className="w-full accent-indigo-600"
                />
                {/* Context-aware description */}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-slate-400">50%</span>
                  <span className="text-xs font-semibold text-indigo-600">{formData.alertThreshold}%</span>
                  <span className="text-xs text-slate-400">95%</span>
                </div>
                {formData.amountLimit && Number(formData.amountLimit) > 0 && (
                  <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 rounded-md px-2.5 py-1.5 text-center">
                    Alert when spending reaches <strong>{formatPrice(Math.round(Number(formData.amountLimit) * formData.alertThreshold / 100))}</strong> of {formatPrice(Number(formData.amountLimit))} limit
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, startDate: e.target.value } : prev)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.endDate}
                    onChange={(e) => setFormData((prev) => prev ? { ...prev, endDate: e.target.value } : prev)}
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
                >
                  {editingItem ? 'Save Changes' : 'Create Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
