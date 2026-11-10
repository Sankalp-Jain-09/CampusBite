import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function NotFoundPage() {
  const { homePath } = useAuth();
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-black text-brand-600">404</p>
      <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-gray-500">The page you're looking for doesn't exist.</p>
      <Link to={homePath} className="btn-primary mt-6">Go home</Link>
    </div>
  );
}
