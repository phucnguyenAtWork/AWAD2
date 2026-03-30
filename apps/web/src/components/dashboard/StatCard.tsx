import { useCurrency } from '../context/CurrencyContext';

interface StatCardProps {
  title: string;
  amount: number;
  type?: 'positive' | 'negative' | 'balance' | 'neutral';
  change?: number | null;
}

export function StatCard({ title, amount, type = 'neutral', change = null }: StatCardProps) {
  const { formatPrice } = useCurrency();
  const isPositive = type === 'positive';
  const isBalance = type === 'balance';

  const iconBg = isPositive
    ? 'bg-emerald-50 text-emerald-600'
    : isBalance
    ? 'bg-indigo-50 text-indigo-600'
    : 'bg-rose-50 text-rose-600';

  // For expense card, spending going UP is bad. For income/balance, going UP is good.
  const changeIsGood =
    change === null ? null : type === 'negative' ? change <= 0 : change >= 0;

  const changeColor =
    changeIsGood === null ? 'text-slate-400'
    : changeIsGood ? 'text-emerald-500'
    : 'text-rose-500';

  const changeArrow = change === null ? '' : change >= 0 ? '▲' : '▼';

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm border border-slate-100 h-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
            {isPositive ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            ) : isBalance ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium text-slate-500">{title}</span>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-2xl font-bold text-slate-900">
          {typeof amount === 'number' ? formatPrice(amount) : amount}
        </h3>
        <div className="mt-1 flex items-center text-xs">
          {change !== null ? (
            <>
              <span className={`font-medium ${changeColor}`}>
                {changeArrow} {Math.abs(change).toFixed(1)}%
              </span>
              <span className="ml-1 text-slate-400">vs last month</span>
            </>
          ) : (
            <span className="text-slate-400">No prior month data</span>
          )}
        </div>
      </div>
    </div>
  );
}
