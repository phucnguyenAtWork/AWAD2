import { useState, useMemo } from 'react';

// Utility: days in month
function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const days: Date[] = [];
  let d = first;
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return days;
}

interface BudgetCalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
}

export function BudgetCalendar({ value, onChange }: BudgetCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(value || new Date(today.getFullYear(), today.getMonth(), 1));
  const days = useMemo(() => getMonthDays(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const startWeekday = days[0]!.getDay();
  const selected = value;

  function prevMonth() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-sm px-2 py-1 rounded hover:bg-slate-100">←</button>
        <h3 className="text-sm font-semibold text-slate-700">
          {cursor.toLocaleString('default', { month: 'long' })} {cursor.getFullYear()}
        </h3>
        <button onClick={nextMonth} className="text-sm px-2 py-1 rounded hover:bg-slate-100">→</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-500 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm">
        {Array.from({ length: startWeekday }).map((_,i) => <div key={i} />)}
        {days.map(d => {
          const isToday = d.toDateString() === today.toDateString();
          const isSelected = selected && d.toDateString() === selected.toDateString();
          return (
            <button
              key={d.toISOString()}
              onClick={() => onChange && onChange(d)}
              className={[
                'h-10 rounded-lg flex flex-col items-center justify-center border',
                isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50',
                isToday && !isSelected ? 'ring-1 ring-indigo-300' : ''
              ].join(' ')}
            >
              <span className="text-xs font-medium">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BudgetCalendar;
