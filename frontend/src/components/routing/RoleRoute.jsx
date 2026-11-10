import ProtectedRoute from './ProtectedRoute';

/** Route group for one or more roles: not logged in → /login, wrong role → /unauthorized. */
export default function RoleRoute({ roles }) {
  return <ProtectedRoute roles={roles} />;
}
