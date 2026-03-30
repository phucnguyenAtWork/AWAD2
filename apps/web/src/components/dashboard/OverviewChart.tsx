import { useMemo } from 'react';
import type { Transaction } from '../../services/types';

interface OverviewChartProps {
  data?: Transaction[];
}

interface MonthData {
  key: string;
  income: number;
  expense: number;
}

type ChartResult = {
  incomePoints: string;
  expensePoints: string;
  labels: string[];
  hasData: boolean;
};

export function OverviewChart({ data = [] }: OverviewChartProps) {
  const { incomePoints, expensePoints, labels, hasData } = useMemo<ChartResult>(() => {
    if (!data || data.length === 0) {
      return { incomePoints: '', expensePoints: '', labels: [], hasData: false };
    }

    // Aggregate by month
    const map: Record<string, MonthData> = {};
    data.forEach(t => {
      const d = new Date(t.occurred_at || t.occurredAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { key, income: 0, expense: 0 };
      const amt = Number(t.amount) || 0;
      if (t.type === 'INCOME') map[key].income += amt;
      else if (t.type === 'EXPENSE') map[key].expense += amt;
    });

    const sorted = Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12);

    if (sorted.length === 0) {
      return { incomePoints: '', expensePoints: '', labels: [], hasData: false };
    }

    const max = Math.max(...sorted.flatMap(d => [d.income, d.expense]), 1);
    const n = sorted.length;

    const toPoints = (values: number[]) =>
      values.map((val, i) => {
        const x = n === 1 ? 50 : (i / (n - 1)) * 100;
        const y = 38 - (val / max) * 33;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

    const monthLabels = sorted.map(({ key }) => {
      const [year, month] = key.split('-');
      return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'short' });
    });

    return {
      incomePoints: toPoints(sorted.map(d => d.income)),
      expensePoints: toPoints(sorted.map(d => d.expense)),
      labels: monthLabels,
      hasData: true,
    };
  }, [data]);

  // Show at most 3 x-axis labels to avoid crowding
  const visibleLabels = labels.length <= 4
    ? labels
    : [labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]];

  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-slate-50/50 px-4 py-4">

      {/* Legend */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-medium text-slate-500">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-rose-400" />
          <span className="text-[10px] font-medium text-slate-500">Expenses</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative flex-1 min-h-0 w-full">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          {[10, 20, 30].map(y => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" />
          ))}

          {!hasData ? (
            <text x="50" y="20" textAnchor="middle" fontSize="3" fill="#94A3B8">No Activity Yet</text>
          ) : (
            <>
              <polyline
                fill="none"
                stroke="#34d399"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={incomePoints}
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                fill="none"
                stroke="#fb7185"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={expensePoints}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
      </div>

      {/* X-axis labels */}
      {hasData && (
        <div className="mt-2 flex justify-between px-1 text-[8px] font-medium text-slate-400 uppercase tracking-wider">
          {visibleLabels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}
