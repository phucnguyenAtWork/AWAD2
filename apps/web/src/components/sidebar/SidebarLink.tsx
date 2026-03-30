import { Link } from 'react-router-dom';

interface SidebarLinkProps {
  to?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export const SidebarLink = ({ to, children, badge, active, onClick, className = '' }: SidebarLinkProps) => {

  const base = `flex w-full items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${className}`;
  const activeCls = active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100';

  const content = (
    <>
      <span className="truncate flex items-center gap-2">{children}</span>
      {badge && (
        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-pink-100 px-2 text-[11px] font-semibold text-pink-600">
          {badge}
        </span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} ${activeCls}`}>
        {content}
      </button>
    );
  }
  return (
    <Link to={to ?? '/'} className={`${base} ${activeCls}`}>
      {content}
    </Link>
  );
};
