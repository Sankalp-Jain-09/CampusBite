import { Link } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import { useAuthForm } from '../../components/auth/useAuthForm';
import Button from '../../components/common/Button';
import ErrorMessage from '../../components/common/ErrorMessage';
import FormField from '../../components/common/FormField';
import { useAuth } from '../../hooks/useAuth';
import { collectErrors, minLength, validateEmail, validatePassword, validatePhone } from '../../utils/validation';

export default function CustomerRegisterPage() {
  const { registerCustomer } = useAuth();
  const { values, errors, formError, submitting, set, onSubmit } = useAuthForm(
    { name: '', email: '', phone: '', password: '', confirm: '', default_address: '' },
    {
      validate: (v) => collectErrors({
        name: minLength(v.name, 2, 'Name'),
        email: validateEmail(v.email),
        phone: validatePhone(v.phone),
        password: validatePassword(v.password),
        confirm: v.confirm !== v.password ? 'Passwords do not match' : null,
      }),
      submit: (v) => registerCustomer({
        name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        password: v.password,
        default_address: v.default_address.trim() || null,
      }),
    },
  );

  return (
    <AuthCard
      title="Create your account"
      subtitle="Order from campus restaurants in a few taps."
      footer={<p>Already have an account? <Link to="/login" className="link">Log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ErrorMessage error={formError} />
        <FormField label="Full name" error={errors.name}>
          <input autoComplete="name" value={values.name} onChange={set('name')} />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <input type="email" autoComplete="email" value={values.email} onChange={set('email')} />
        </FormField>
        <FormField label="Phone" error={errors.phone}>
          <input type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} placeholder="9876543210" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Password" error={errors.password} hint="At least 8 characters">
            <input type="password" autoComplete="new-password" value={values.password} onChange={set('password')} />
          </FormField>
          <FormField label="Confirm password" error={errors.confirm}>
            <input type="password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />
          </FormField>
        </div>
        <FormField label="Delivery address (optional)" error={errors.default_address} hint="Pre-fills checkout">
          <textarea rows={2} value={values.default_address} onChange={set('default_address')} placeholder="Hostel B, Room 214" />
        </FormField>
        <Button type="submit" className="w-full" loading={submitting}>Create account</Button>
      </form>
    </AuthCard>
  );
}
