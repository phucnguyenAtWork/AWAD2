import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';

export function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    logout();
    const t = setTimeout(() => navigate('/login'), 600);
    return () => clearTimeout(t);
  }, [logout, navigate]);
  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xs p-6 text-center">
        <p className="text-sm text-gray-600">Signing you out...</p>
      </Card>
    </div>
  );
}
