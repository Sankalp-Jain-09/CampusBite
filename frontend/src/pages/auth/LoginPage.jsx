import { Link, useLocation, useSearchParams } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import { useAuthForm } from '../../components/auth/useAuthForm';
import Button from '../../components/common/Button';
import ErrorMessage from '../../components/common/ErrorMessage';
import FormField from '../../components/common/FormField';
import { useAuth } from '../../hooks/useAuth';
import { canAccessPath } from '../../utils/constants';
import { collectErrors, required, validateEmail } from '../../utils/validation';

export default function LoginPage() {
  const { login, logoutReason } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const fromLocation = location.state?.from;
  const from = fromLocation?.pathname;
  const expired = Boolean(params.get('expired')) || logoutReason === 'expired';

  const { values, errors, formError, submitting, set, onSubmit } = useAuthForm(
    { email: '', password: '' },
    {
      validate: (v) => collectErrors({ email: validateEmail(v.email), password: required(v.password, 'Password') }),
      submit: (v) => login(v.email.trim(), v.password),
      // Go back to the page that required login, if this role is allowed there; otherwise the role's home.
      redirectTo: (user) => (canAccessPath(user.role, from) ? `${from}${fromLocation.search || ''}` : null),
    },
  );

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in as a customer, restaurant owner or delivery partner."
      footer={(
        <div className="space-y-1">
          <p>New here? <Link to="/register" className="link">Create a customer account</Link></p>
          <p>
            <Link to="/partner/register" className="link">Partner with us</Link>
            {' · '}
            <Link to="/delivery/register" className="link">Ride with us</Link>
          </p>
        </div>
      )}
    >
      {expired && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your session expired. Please log in again.</p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ErrorMessage error={formError} />
        <FormField label="Email" error={errors.email}>
          <input type="email" autoComplete="email" value={values.email} onChange={set('email')} placeholder="you@example.com" />
        </FormField>
        <FormField label="Password" error={errors.password}>
          <input type="password" autoComplete="current-password" value={values.password} onChange={set('password')} />
        </FormField>
        <Button type="submit" className="w-full" loading={submitting}>Log in</Button>
      </form>
      <details className="mt-6 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-700">Demo accounts (seeded data)</summary>
        <p className="mt-2">Password for all: <code className="rounded bg-white px-1">Demo@1234</code></p>
        <ul className="mt-1 space-y-0.5 font-mono text-xs">
          <li>demo.customer@campusbite.dev — customer</li>
          <li>owner.curry@campusbite.dev — restaurant owner</li>
          <li>rider.one@campusbite.dev — delivery partner</li>
        </ul>
      </details>
    </AuthCard>
  );
}
