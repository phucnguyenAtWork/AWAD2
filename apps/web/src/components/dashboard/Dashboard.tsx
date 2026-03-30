import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { financeService } from '../../services/finance';
import type { Budget, Transaction } from '../../services/types';

import { YearlySummary } from './YearlySummary';
import { StatCard } from './StatCard';
import { OverviewChart } from './OverviewChart';
import { TransactionTable } from './TransactionTable';
import { BudgetGauge } from './BudgetGauge';
import { CategoryDonut } from './CategoryDonut';
import { BurnoutRatio } from './BurnoutRatio';

export function Dashboard() {
  const { token, user, logout } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [txData, budgetData] = await Promise.all([
        financeService.listTransactions(token, { onUnauthorized: logout }),
        financeService.listBudgets(token, { onUnauthorized: logout }),
      ]);
      setTransactions(txData);
      setBudgets(budgetData);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Dashboard load failed', err);
    } finally {
      setLoading(false);
    }
  }, [logout, token]);

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
              <StatCard title="Received" amount={stats.totalIncome} type="positive" change={stats.incomeChange} />
              <StatCard title="Sent" amount={stats.totalExpense} type="negative" change={stats.expenseChange} />
              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <StatCard title="Net Balance" amount={stats.totalBalance} type="balance" change={stats.balanceChange} />
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
          <BudgetGauge spent={stats.budgetSpent} limit={stats.realTotalLimit} />

          <BurnoutRatio spent={stats.budgetSpent} limit={stats.realTotalLimit} />

          <CategoryDonut transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
