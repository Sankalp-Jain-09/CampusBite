import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';

/** Public browsing pages: owners and delivery partners are sent to their own dashboards. */
export default function CustomerHome({ children }) {
  const { user, homePath } = useAuth();
  if (user && user.role !== ROLES.CUSTOMER) return <Navigate to={homePath} replace />;
  return children;
}
