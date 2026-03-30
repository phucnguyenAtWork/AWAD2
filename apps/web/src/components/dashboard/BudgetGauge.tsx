import { useCurrency } from '../context/CurrencyContext';

export function BudgetGauge({ spent = 0, limit = 0 }) {
  const { formatPrice } = useCurrency();
  const noBudget = limit === 0;
  const safeLimit = noBudget ? 1 : limit;
  const percentage = noBudget ? 0 : Math.min((spent / safeLimit) * 100, 100);

  // Color Logic
  let color = "#22c55e"; // Green
  if (percentage > 50) color = "#eab308"; // Yellow
  if (percentage > 85) color = "#ef4444"; // Red

  if (noBudget) {
    return (
      <div className="flex w-full flex-col items-center justify-center rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-100">
        <h3 className="mb-4 w-full text-left text-sm sm:text-base font-bold text-slate-900">Budget Health</h3>
        <div className="py-6 text-center text-sm text-slate-400">
          <p className="font-medium">No budgets set</p>
          <p className="text-xs mt-1">Add a budget to track your spending health</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-100">
      <h3 className="mb-4 w-full text-left text-sm sm:text-base font-bold text-slate-900">Budget Health</h3>
      <div className="relative w-full max-w-[240px] aspect-[2/1] flex items-end justify-center">

        <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">

          {/* Background Track */}
          <path
            d="M 30 90 A 70 70 0 0 1 170 90"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Progress Arc */}
          <path
            d="M 30 90 A 70 70 0 0 1 170 90"
            fill="none"
            stroke={color}
            strokeWidth="20"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${percentage} 100`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Text */}
        <div className="absolute bottom-0 mb-0 flex flex-col items-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">
              {Math.round(percentage)}%
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Used
            </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex w-full justify-between border-t border-slate-50 pt-4 text-xs sm:text-sm">
        <div className="flex flex-col">
            <span className="font-medium text-slate-400">Spent</span>
            <span className="font-bold text-slate-700 truncate max-w-[80px] sm:max-w-none">
              {formatPrice(spent)}
            </span>
        </div>
        <div className="flex flex-col text-right">
            <span className="font-medium text-slate-400">Limit</span>
            <span className="font-bold text-slate-700 truncate max-w-[80px] sm:max-w-none">
              {formatPrice(limit)}
            </span>
        </div>
      </div>
    </div>
  );
}
