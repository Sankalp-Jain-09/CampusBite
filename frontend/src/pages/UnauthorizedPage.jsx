import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS } from '../utils/constants';

export default function UnauthorizedPage() {
  const { user, homePath } = useAuth();
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-black text-brand-600">403</p>
      <h1 className="mt-3 text-xl font-semibold">You don't have access to this page</h1>
      <p className="mt-1 text-sm text-gray-500">
        {user ? `You're logged in as a ${ROLE_LABELS[user.role].toLowerCase()}.` : 'Please log in first.'}
      </p>
      <Link to={homePath} className="btn-primary mt-6">Go to my home page</Link>
    </div>
  );
}
