import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../common/Loader';

/** Logged-in users only; optionally restricted to `roles`. */
export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, loading, user, logoutReason } = useAuth();
  const location = useLocation();

  if (loading) return <Loader text="Checking your session…" />;
  if (!isAuthenticated) {
    // Keep the reason, so the login page can say "Your session expired" instead of showing a bare form.
    const to = logoutReason === 'expired' ? '/login?expired=1' : '/login';
    // After a deliberate logout, don't send the next login back to this page.
    return <Navigate to={to} replace state={logoutReason === 'manual' ? undefined : { from: location }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
