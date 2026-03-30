import { useMemo } from 'react';
import type { Transaction } from '../../services/types';

interface CategoryDonutProps {
  transactions?: Transaction[];
}

export function CategoryDonut({ transactions = [] }: CategoryDonutProps) {

  // 1. Group Data by Category
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;

    transactions.forEach(t => {
      // Filter for Expenses only
      if (t.type === 'EXPENSE') {
        const amt = Math.abs(Number(t.amount));
        // Fallback if no category name
        const cat = t.category_name || 'Uncategorized';
        map[cat] = (map[cat] || 0) + amt;
        total += amt;
      }
    });

    // Convert to array and sort by biggest expense
    return Object.entries(map)
      .map(([name, value], index) => ({
        name,
        value,
        percent: (value / total) * 100,
        // Assign distinct colors based on index
        color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5]
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 2. Build Conic Gradient String
  // Format: "red 0% 20%, blue 20% 60%, green 60% 100%"
  const gradientString = useMemo(() => {
    let currentDeg = 0;
    return data.map(item => {
      const start = currentDeg;
      const end = currentDeg + item.percent;
      currentDeg = end;
      return `${item.color} ${start}% ${end}%`;
    }).join(', ');
  }, [data]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
      <h3 className="mb-6 font-bold text-slate-900">Expense by Category</h3>

      <div className="flex items-center gap-6">
        {/* The Donut (CSS Conic Gradient) */}
        <div
          className="relative h-32 w-32 rounded-full shrink-0"
          style={{ background: `conic-gradient(${gradientString || '#e2e8f0 0% 100%'})` }}
        >
           {/* The Hole in the Donut */}
           <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center shadow-inner">
              <span className="text-xs font-bold text-slate-400">EXP</span>
           </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.slice(0, 4).map(item => (
            <div key={item.name} className="flex items-center justify-between text-sm">
               <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: item.color }}></span>
                  <span className="text-slate-600 truncate max-w-[80px]">{item.name}</span>
               </div>
               <span className="font-semibold text-slate-900">{Math.round(item.percent)}%</span>
            </div>
          ))}
          {data.length === 0 && <div className="text-sm text-slate-400">No expenses yet</div>}
        </div>
      </div>
    </div>
  );
}
