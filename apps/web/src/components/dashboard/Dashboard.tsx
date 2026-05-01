import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { financeService, type BudgetPreferences } from '../../services/finance';
import { insightsService, type ForecastResponse } from '../../services/insights';
import type { Budget, Transaction } from '../../services/types';
import { useCurrency } from '../context/CurrencyContext';

import { YearlySummary } from './YearlySummary';
import { StatCard } from './StatCard';
import { OverviewChart } from './OverviewChart';
import { TransactionTable } from './TransactionTable';
import { BudgetGauge } from './BudgetGauge';
import { CategoryDonut } from './CategoryDonut';
import { BurnoutRatio } from './BurnoutRatio';

export function Dashboard() {
  const { token, user, logout } = useAuth();
  const { formatPrice } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetSplit, setBudgetSplit] = useState<BudgetPreferences | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [txData, budgetData, splitData, forecastData] = await Promise.all([
        financeService.listTransactions(token, { onUnauthorized: logout }),
        financeService.listBudgets(token, { onUnauthorized: logout }),
        user?.id ? financeService.getBudgetPreferences(token, user.id, { onUnauthorized: logout }) : Promise.resolve(null),
        user?.id
          ? insightsService.getForecast(token, user.id, { onUnauthorized: logout }).catch(() => null)
          : Promise.resolve(null),
      ]);
      setTransactions(txData);
      setBudgets(budgetData);
      setBudgetSplit(splitData);
      setForecast(forecastData);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Dashboard load failed', err);
    } finally {
      setLoading(false);
    }
  }, [logout, token, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let currentMonthExpenses = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let thisMonthIncome = 0;
    let lastMonthIncome = 0;
    let thisMonthExpense = 0;
    let lastMonthExpense = 0;

    transactions.forEach((t) => {
      const amt = Number(t.amount || 0);
      const txDate = new Date(t.occurredAt || t.occurred_at);
      const m = txDate.getMonth();
      const y = txDate.getFullYear();

      if (t.type === 'INCOME') {
        totalIncome += amt;
        if (m === currentMonth && y === currentYear) thisMonthIncome += amt;
        if (m === lastMonth && y === lastMonthYear) lastMonthIncome += amt;
      } else if (t.type === 'EXPENSE') {
        totalExpense += amt;
        if (m === currentMonth && y === currentYear) {
          currentMonthExpenses += amt;
          thisMonthExpense += amt;
        }
        if (m === lastMonth && y === lastMonthYear) lastMonthExpense += amt;
      }
    });

    const pctChange = (current: number, prior: number) => (prior > 0 ? ((current - prior) / prior) * 100 : null);

    const totalBalance = totalIncome - totalExpense;
    const thisMonthBalance = thisMonthIncome - thisMonthExpense;
    const lastMonthBalance = lastMonthIncome - lastMonthExpense;

    return {
      totalIncome,
      totalExpense,
      currentMonthExpenses,
      totalBalance,
      thisMonthIncome,
      thisMonthExpense,
      thisMonthBalance,
      realTotalLimit: budgets.reduce((sum, b) => sum + Number(b.amountLimit ?? 0), 0),
      budgetSpent: budgets.reduce((sum, b) => {
        const start = new Date(b.startDate).getTime();
        const end = new Date(b.endDate).getTime() + 86400000;
        let spent = 0;
        for (const tx of transactions) {
          if (tx.type !== 'EXPENSE') continue;
          const txTime = new Date(tx.occurredAt).getTime();
          if (txTime < start || txTime >= end) continue;
          if (b.categoryId) {
            // Category-specific budget
            const budgetCatName = b.categoryName?.toLowerCase();
            if ((tx.categoryName?.toLowerCase() ?? '') !== budgetCatName && tx.categoryId !== b.categoryId) continue;
          }
          spent += tx.amount;
        }
        return sum + spent;
      }, 0),
      recentTx: [...transactions]
        .sort((a, b) => new Date(b.occurredAt || b.occurred_at).getTime() - new Date(a.occurredAt || a.occurred_at).getTime())
        .slice(0, 5),
      incomeChange: pctChange(thisMonthIncome, lastMonthIncome),
      expenseChange: pctChange(thisMonthExpense, lastMonthExpense),
      balanceChange: pctChange(thisMonthBalance, lastMonthBalance),
    };
  }, [transactions, budgets]);

  const activeSplit = budgetSplit ?? { needs_pct: 50, wants_pct: 30, savings_pct: 20 };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 animate-in fade-in duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.fullName || user?.phone || 'there'}!</h1>
          <p className="text-sm text-slate-500">Here is your financial overview.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <YearlySummary transactions={transactions} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <StatCard title="Received (This Month)" amount={stats.thisMonthIncome} type="positive" change={stats.incomeChange} />
              <StatCard title="Spent (This Month)" amount={stats.thisMonthExpense} type="negative" change={stats.expenseChange} />
              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <StatCard title="Net (This Month)" amount={stats.thisMonthBalance} type="balance" change={stats.balanceChange} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Overview</h3>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span>Live Data</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <OverviewChart data={transactions} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <TransactionTable transactions={stats.recentTx} limit={5} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Budget Split</h3>
                <p className="text-sm text-slate-500">Your active needs / wants / savings rule</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {activeSplit.needs_pct}/{activeSplit.wants_pct}/{activeSplit.savings_pct}
              </div>
            </div>

            <div className="overflow-hidden rounded-full bg-slate-100 h-4">
              <div className="flex h-full w-full">
                <div className="bg-emerald-500" style={{ width: `${activeSplit.needs_pct}%` }} />
                <div className="bg-amber-500" style={{ width: `${activeSplit.wants_pct}%` }} />
                <div className="bg-indigo-500" style={{ width: `${activeSplit.savings_pct}%` }} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-emerald-50 px-3 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-700">Needs</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{activeSplit.needs_pct}%</div>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-amber-700">Wants</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{activeSplit.wants_pct}%</div>
              </div>
              <div className="rounded-xl bg-indigo-50 px-3 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-700">Savings</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{activeSplit.savings_pct}%</div>
              </div>
            </div>
          </div>

          <ForecastCard forecast={forecast} thisMonthExpense={stats.thisMonthExpense} formatPrice={formatPrice} />

          <BudgetGauge spent={stats.budgetSpent} limit={stats.realTotalLimit} />

          <BurnoutRatio spent={stats.budgetSpent} limit={stats.realTotalLimit} />

          <CategoryDonut transactions={transactions} />
        </div>
      </div>
    </div>
  );
}

interface ForecastCardProps {
  forecast: ForecastResponse | null;
  thisMonthExpense: number;
  formatPrice: (n: number) => string;
}

function ForecastCard({ forecast, thisMonthExpense, formatPrice }: ForecastCardProps) {
  const projected = forecast?.monthly?.total ?? null;
  const rawConfidence = forecast?.confidence ?? null;
  // FINA Brain returns confidence on a 0–100 scale for /forecast and 0–1 for callbacks; auto-detect.
  const confidencePct =
    rawConfidence === null
      ? null
      : Math.max(0, Math.min(100, Math.round(rawConfidence > 1 ? rawConfidence : rawConfidence * 100)));
  const sourceLabel = forecast?.source === 'lstm' ? 'LSTM' : forecast?.source ?? 'forecast';
  const remaining = projected !== null ? Math.max(0, projected - thisMonthExpense) : null;
  const updatedAt = forecast?.cachedAt ? new Date(forecast.cachedAt).toLocaleString() : null;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Projected Month-End Spend</h3>
          <p className="text-sm text-slate-500">FINA {sourceLabel} forecast</p>
        </div>
        {confidencePct !== null && (
          <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {confidencePct}% confidence
          </div>
        )}
      </div>

      {projected === null ? (
        <p className="text-sm text-slate-400">Forecast unavailable. Train the LSTM model or check FINA Brain connectivity.</p>
      ) : (
        <>
          <div className="text-2xl font-bold text-slate-900">{formatPrice(projected)}</div>
          <div className="mt-1 text-xs text-slate-500">
            Spent so far this month: <span className="font-medium text-slate-700">{formatPrice(thisMonthExpense)}</span>
            {remaining !== null && (
              <> · Projected remaining: <span className="font-medium text-slate-700">{formatPrice(remaining)}</span></>
            )}
          </div>
          {updatedAt && <div className="mt-2 text-[11px] text-slate-400">Updated {updatedAt}</div>}
        </>
      )}
    </div>
  );
}
