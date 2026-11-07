import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function SellerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'SELLER') return <Navigate to="/" replace />;
  return <>{children}</>;
}
