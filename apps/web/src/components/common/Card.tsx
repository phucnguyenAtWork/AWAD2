export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-md shadow-slate-100 p-6 ${className}`}>{children}</div>
);
