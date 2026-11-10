import { Link } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import { useAuthForm } from '../../components/auth/useAuthForm';
import Button from '../../components/common/Button';
import ErrorMessage from '../../components/common/ErrorMessage';
import FormField from '../../components/common/FormField';
import { useAuth } from '../../hooks/useAuth';
import { VEHICLE_TYPES } from '../../utils/constants';
import { collectErrors, minLength, required, validateEmail, validatePassword, validatePhone } from '../../utils/validation';

export default function DeliveryRegisterPage() {
  const { registerDeliveryPartner } = useAuth();
  const { values, errors, formError, submitting, set, onSubmit } = useAuthForm(
    { name: '', email: '', phone: '', password: '', vehicle_type: '', vehicle_number: '' },
    {
      validate: (v) => collectErrors({
        name: minLength(v.name, 2, 'Name'),
        email: validateEmail(v.email),
        phone: validatePhone(v.phone),
        password: validatePassword(v.password),
        vehicle_type: required(v.vehicle_type, 'Vehicle type'),
        vehicle_number: minLength(v.vehicle_number, 4, 'Vehicle number'),
      }),
      submit: (v) => registerDeliveryPartner({
        name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        password: v.password,
        vehicle_type: v.vehicle_type,
        vehicle_number: v.vehicle_number.trim(),
      }),
    },
  );

  return (
    <AuthCard
      title="Ride with us"
      subtitle="Deliver food around campus on your own schedule."
      footer={<p>Already riding with us? <Link to="/login" className="link">Log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ErrorMessage error={formError} />
        <FormField label="Full name" error={errors.name}><input value={values.name} onChange={set('name')} autoComplete="name" /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" error={errors.email}><input type="email" value={values.email} onChange={set('email')} autoComplete="email" /></FormField>
          <FormField label="Phone" error={errors.phone}><input type="tel" value={values.phone} onChange={set('phone')} /></FormField>
        </div>
        <FormField label="Password" error={errors.password} hint="At least 8 characters">
          <input type="password" value={values.password} onChange={set('password')} autoComplete="new-password" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Vehicle type" error={errors.vehicle_type}>
            <select value={values.vehicle_type} onChange={set('vehicle_type')}>
              <option value="">Select…</option>
              {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </FormField>
          <FormField label="Vehicle number" error={errors.vehicle_number}>
            <input value={values.vehicle_number} onChange={set('vehicle_number')} placeholder="KA01AB1234" className="input uppercase" />
          </FormField>
        </div>
        <Button type="submit" className="w-full" loading={submitting}>Join as delivery partner</Button>
      </form>
    </AuthCard>
  );
}
