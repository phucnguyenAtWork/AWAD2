interface Segment {
  label: string;
  value: number;
  color: string;
}

interface PieDonutProps {
  title: string;
  segments: Segment[];
  size?: number;
  thickness?: number;
}

// segments: [{ label, value, color }]
export function PieDonut({ title, segments, size = 300, thickness = 44 }: PieDonutProps) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const radius = (size / 2) - 4;
  const center = size / 2;
  let cumulative = 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="flex items-center gap-6">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="shrink-0 w-full max-w-[200px] h-auto"
          >
          {segments.map((s, i) => {
            const startAngle = (cumulative / total) * Math.PI * 2;
            cumulative += s.value;
            const endAngle = (cumulative / total) * Math.PI * 2;
            const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
            const x1 = center + radius * Math.sin(startAngle);
            const y1 = center - radius * Math.cos(startAngle);
            const x2 = center + radius * Math.sin(endAngle);
            const y2 = center - radius * Math.cos(endAngle);
            const pathData = [
              `M ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
              `L ${center} ${center}`,
              'Z'
            ].join(' ');
            return <path key={i} d={pathData} fill={s.color} opacity={0.85} stroke="#fff" strokeWidth="1" />;
          })}
          <circle cx={center} cy={center} r={radius - thickness} fill="#fff" />
          <text x={center} y={center - 4} textAnchor="middle" fontSize="14" fontWeight="600" fill="#1e293b">{total}</text>
          <text x={center} y={center + 14} textAnchor="middle" fontSize="10" fill="#64748b">total</text>
        </svg>
  <ul className="flex-1 space-y-2 text-xs">
          {segments.map(s => (
            <li key={s.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background:s.color }} />
                {s.label}
              </span>
              <span className="font-medium">{s.value} ({Math.round((s.value/total)*100)}%)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default PieDonut;
