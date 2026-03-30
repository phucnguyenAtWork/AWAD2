import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

type ProtectedRouteProps = {
  children: React.ReactElement;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthed, onboarded } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!onboarded) return <Navigate to="/signup" replace />;
  return children;
}
