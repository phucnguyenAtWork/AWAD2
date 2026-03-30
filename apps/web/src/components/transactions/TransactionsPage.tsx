import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../common/Card';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { financeService, type TransactionDraft } from '../../services/finance';
import type { Category, Transaction } from '../../services/types';

type ModalMode = 'CREATE' | 'EDIT';

type TransactionFormState = {
  id?: string;
  occurredAt: string;
  amount: number | '';
  description: string;
  categoryId: string | null;
  type: Transaction['type'];
  essential: boolean;
  tags: string[];
};

const toDateInput = (iso: string): string => iso.slice(0, 10);

const FILTER_OPTIONS: Array<'ALL' | Transaction['type'] | 'TRANSFER'> = ['ALL', 'EXPENSE', 'INCOME'];
const TRANSACTION_TYPES: Transaction['type'][] = ['EXPENSE', 'INCOME'];

export function TransactionsPage() {
  const { token, logout } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const currencySymbol = currency === 'USD' ? '$' : '₫';
  const [items, setItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | Transaction['type'] | 'TRANSFER'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<'date' | 'amount' | 'description' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('CREATE');
  const [currentTx, setCurrentTx] = useState<TransactionFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const [txData, categoryData] = await Promise.all([
        financeService.listTransactions(token, { onUnauthorized: logout }),
        financeService.listCategories(token, undefined, { onUnauthorized: logout }),
      ]);
      setItems(txData);
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      const deduped = [];
      for (const c of categoryData) {
        const idKey = c.id;
        const nameKey = c.name.trim().toLowerCase();
        if (seenIds.has(idKey) || seenNames.has(nameKey)) continue;
        seenIds.add(idKey);
        seenNames.add(nameKey);
        deduped.push(c);
      }
      setCategories(deduped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load transactions';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [logout, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeFilter === 'INCOME' && categoryFilter !== 'ALL') {
      setCategoryFilter('ALL');
    }
  }, [categoryFilter, typeFilter]);

  const openAddModal = () => {
    setModalMode('CREATE');
    setCurrentTx({
      occurredAt: new Date().toISOString(),
      amount: '',
      description: '',
      categoryId: categories[0]?.id ?? null,
      type: 'EXPENSE',
      essential: false,
      tags: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setModalMode('EDIT');
    setCurrentTx({
      id: tx.id,
      occurredAt: tx.occurredAt,
      amount: Math.abs(tx.amount),
      description: tx.description ?? '',
      categoryId: tx.categoryId ?? null,
      type: tx.type,
      essential: tx.essential,
      tags: tx.tags,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      setItems((prev) => prev.filter((item) => item.id !== id));
      await financeService.deleteTransaction(token, id, { onUnauthorized: logout });
    } finally {
      setDeleteConfirmId(null);
      void loadData();
    }
  };

  const handleSave = async () => {
    if (!token || !currentTx) return;
    if (!currentTx.occurredAt || !currentTx.amount || !currentTx.description) {
      alert('Please fill in Date, Amount, and Description');
      return;
    }

    const normalizedCategory =
      currentTx.type === 'INCOME' ? undefined : currentTx.categoryId || undefined;

    const payload: TransactionDraft = {
      type: currentTx.type,
      amount: Number(currentTx.amount),
      description: currentTx.description,
      categoryId: normalizedCategory,
      essential: currentTx.essential,
      tags: currentTx.tags,
      occurredAt: currentTx.occurredAt,
    };
    if (!payload.categoryId) {
      delete (payload as { categoryId?: string }).categoryId;
    }
    try {
      setSaving(true);
      if (modalMode === 'CREATE') {
        await financeService.createTransaction(token, payload, { onUnauthorized: logout });
      } else if (currentTx.id) {
        await financeService.updateTransaction(token, currentTx.id, payload, { onUnauthorized: logout });
      }
      setModalOpen(false);
      void loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save transaction';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items
      .filter((t) => {
        const matchesSearch =
          !term ||
          `${t.occurredAt} ${t.type} ${t.description} ${t.categoryName ?? ''}`
            .toLowerCase()
            .includes(term);
        const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
        const matchesCategory = categoryFilter === 'ALL' || t.categoryId === categoryFilter;
        return matchesSearch && matchesType && matchesCategory;
      })
      .sort((a, b) => {
        let aVal: number | string = '';
        let bVal: number | string = '';
        if (sortKey === 'amount') {
          aVal = Math.abs(a.amount);
          bVal = Math.abs(b.amount);
        } else if (sortKey === 'date') {
          aVal = new Date(a.occurredAt).getTime();
          bVal = new Date(b.occurredAt).getTime();
        } else if (sortKey === 'description') {
          aVal = a.description ?? '';
          bVal = b.description ?? '';
        } else {
          aVal = a.categoryName ?? '';
          bVal = b.categoryName ?? '';
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [items, q, typeFilter, categoryFilter, sortKey, sortDir]);

  const summary = useMemo(() => {
    const income = filtered.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const formatAmount = (amount: number, type: Transaction['type']) => {
    const signed = type === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount);
    const color = signed >= 0 ? 'text-emerald-600' : 'text-slate-900';
    const sign = signed >= 0 ? '+' : '-';
    return { display: `${sign}${formatPrice(Math.abs(signed))}`, color };
  };

  const categoryNameById = (categoryId: string | null, type: Transaction['type']): string => {
    if (type === 'INCOME') return '—';
    if (!categoryId) return 'Uncategorized';
    const found = categories.find((c) => c.id === categoryId);
    return found?.name ?? 'Uncategorized';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Transactions</h2>
          <p className="text-sm text-slate-500">Manage your income and expenses</p>
        </div>
        <button onClick={openAddModal} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors">
          + Add Transaction
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Income</p>
          <p className="text-lg font-bold text-emerald-700 mt-0.5">+{formatPrice(summary.income)}</p>
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
          <p className="text-xs font-medium text-rose-600 uppercase tracking-wide">Expenses</p>
          <p className="text-lg font-bold text-rose-700 mt-0.5">-{formatPrice(summary.expense)}</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${summary.net >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${summary.net >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>Net</p>
          <p className={`text-lg font-bold mt-0.5 ${summary.net >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
            {summary.net >= 0 ? '+' : ''}{formatPrice(Math.abs(summary.net))}
          </p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <span className="text-sm text-slate-500 shrink-0">
            {loading ? 'Loading...' : `${filtered.length} of ${items.length}`}
          </span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            {FILTER_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md transition-all ${typeFilter === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {typeFilter !== 'INCOME' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="ml-auto w-48 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th onClick={() => toggleSort('date')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                <th onClick={() => toggleSort('category')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                  Category
                </th>
                <th onClick={() => toggleSort('description')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                  Description
                </th>
                <th onClick={() => toggleSort('amount')} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                  Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((t) => {
                const { display, color } = formatAmount(t.amount, t.type);
                const isConfirmingDelete = deleteConfirmId === t.id;
                return (
                  <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {new Date(t.occurredAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          t.type === 'INCOME'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t.type === 'INCOME' ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {categoryNameById(t.categoryId, t.type)}
                          </span>
                          {t.essential && (
                            <span className="ml-1 text-amber-500 text-xs" title="Essential">
                              ⭐
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      <div className="font-medium">{t.description}</div>
                      {t.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {t.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      <span className={`${color} font-bold`}>
                        {display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {isConfirmingDelete ? (
                        <div className="flex justify-end items-center gap-2">
                          <span className="text-xs text-slate-500">Delete?</span>
                          <button onClick={() => handleDelete(t.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800">
                            Yes
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal(t)} className="text-indigo-600 hover:text-indigo-900 font-medium text-xs uppercase">
                            Edit
                          </button>
                          <button onClick={() => setDeleteConfirmId(t.id)} className="text-rose-600 hover:text-rose-900 font-medium text-xs uppercase">
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-400 text-sm" colSpan={6}>
                    {items.length === 0
                      ? 'No transactions yet. Click "+ Add Transaction" to create one.'
                      : 'No transactions match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && currentTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {modalMode === 'CREATE' ? 'New Transaction' : 'Edit Transaction'}
              </h3>
              <div className="flex rounded-lg bg-slate-200 p-1">
                {TRANSACTION_TYPES.map((tab) => (
                  <button
                    key={tab}
                    onClick={() =>
                      setCurrentTx((prev) =>
                        prev
                          ? {
                              ...prev,
                              type: tab,
                              categoryId: tab === 'INCOME' ? null : prev.categoryId ?? categories[0]?.id ?? null,
                            }
                          : prev,
                      )
                    }
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                      currentTx.type === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Amount *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">{currencySymbol}</span>
                  <input
                    type="number"
                    value={currentTx.amount}
                    onChange={(e) =>
                      setCurrentTx((prev) => (prev ? { ...prev, amount: Number(e.target.value) } : prev))
                    }
                    placeholder="0"
                    className="w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-4 text-2xl font-bold text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date *</label>
                <input
                  type="date"
                  value={toDateInput(currentTx.occurredAt)}
                  onChange={(e) =>
                    setCurrentTx((prev) => (prev ? { ...prev, occurredAt: new Date(e.target.value).toISOString() } : prev))
                  }
                  className="w-full rounded-lg border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              {currentTx.type === 'EXPENSE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={currentTx.categoryId ?? ''}
                    onChange={(e) =>
                      setCurrentTx((prev) => (prev ? { ...prev, categoryId: e.target.value || null } : prev))
                    }
                    className="w-full rounded-lg border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description *</label>
                <input
                  type="text"
                  value={currentTx.description}
                  onChange={(e) =>
                    setCurrentTx((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                  }
                  placeholder="What was this for?"
                  className="w-full rounded-lg border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentTx.essential}
                    onChange={(e) =>
                      setCurrentTx((prev) => (prev ? { ...prev, essential: e.target.checked } : prev))
                    }
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Essential Expense ⭐</span>
                </label>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-95"
              >
                {saving ? 'Saving...' : modalMode === 'CREATE' ? 'Create Transaction' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsPage;
