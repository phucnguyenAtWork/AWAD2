export function BurnoutRatio({ spent = 0, limit = 0 }) {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();
  const timePercent = (currentDay / daysInMonth) * 100;

  // 2. Calculate Actual Spend
  const safeLimit = limit > 0 ? limit : 1;
  const spendPercent = Math.min((spent / safeLimit) * 100, 100);

  // 3. Determine Status (Are they burning out?)
  const diff = spendPercent - timePercent;

  let message = "You are on track.";
  let color = "bg-emerald-500";
  let textColor = "text-emerald-700";
  let bgColor = "bg-emerald-50";

  if (limit === 0) {
      message = "Set a budget limit to see your pace.";
      color = "bg-slate-300";
      textColor = "text-slate-600";
      bgColor = "bg-slate-50";
  } else if (diff > 10) {
      // Spent 10% MORE than the time elapsed
      message = "Slow down! You are burning through your budget too fast.";
      color = "bg-rose-500";
      textColor = "text-rose-700";
      bgColor = "bg-rose-50";
  } else if (diff > 0) {
      // Spent slightly more than time elapsed
      message = "Careful, spending is slightly ahead of schedule.";
      color = "bg-amber-500";
      textColor = "text-amber-700";
      bgColor = "bg-amber-50";
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Burnout Ratio</h3>
        <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${bgColor} ${textColor} border-opacity-50`}>
          Pace Check
        </span>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>

      <div className="space-y-5 mt-2">
        {/* Time Progress */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Month Elapsed (Ideal Pace)</span>
            <span className="font-bold text-slate-700">{Math.round(timePercent)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-indigo-200 transition-all duration-1000" style={{ width: `${timePercent}%` }} />
          </div>
        </div>

        {/* Spend Progress */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Actual Budget Spent</span>
            <span className="font-bold text-slate-700">{Math.round(spendPercent)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${color}`} style={{ width: `${spendPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
