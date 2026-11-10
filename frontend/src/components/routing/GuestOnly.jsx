import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { canAccessPath } from '../../utils/constants';
import Loader from '../common/Loader';

/**
 * Login / signup pages: logged-in users are sent on. Right after logging in, that is the page that
 * required login (location.state.from) when the user's role may open it; otherwise the role's home page.
 * This must happen here: once the user is set, this guard re-renders before the form's own redirect runs.
 */
export default function GuestOnly({ children }) {
  const { isAuthenticated, loading, homePath, user } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (isAuthenticated) {
    const from = location.state?.from;
    const target = from?.pathname && canAccessPath(user?.role, from.pathname)
      ? `${from.pathname}${from.search || ''}`
      : homePath;
    return <Navigate to={target} replace />;
  }
  return children;
}
