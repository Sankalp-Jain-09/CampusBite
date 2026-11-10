import { Link } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import { useAuthForm } from '../../components/auth/useAuthForm';
import Button from '../../components/common/Button';
import ErrorMessage from '../../components/common/ErrorMessage';
import FormField from '../../components/common/FormField';
import { useAuth } from '../../hooks/useAuth';
import { collectErrors, minLength, validateEmail, validatePassword, validatePhone } from '../../utils/validation';

export default function PartnerRegisterPage() {
  const { registerOwner } = useAuth();
  const { values, errors, formError, submitting, set, onSubmit } = useAuthForm(
    {
      name: '', email: '', phone: '', password: '',
      r_name: '', r_cuisine: '', r_address: '', r_phone: '', r_description: '',
    },
    {
      validate: (v) => collectErrors({
        name: minLength(v.name, 2, 'Name'),
        email: validateEmail(v.email),
        phone: validatePhone(v.phone),
        password: validatePassword(v.password),
        'restaurant.name': minLength(v.r_name, 2, 'Restaurant name'),
        'restaurant.cuisine': minLength(v.r_cuisine, 2, 'Cuisine'),
        'restaurant.address': minLength(v.r_address, 5, 'Address'),
        'restaurant.phone': validatePhone(v.r_phone),
      }),
      submit: (v) => registerOwner({
        name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        password: v.password,
        restaurant: {
          name: v.r_name.trim(),
          cuisine: v.r_cuisine.trim(),
          address: v.r_address.trim(),
          phone: v.r_phone.trim(),
          description: v.r_description.trim() || null,
        },
      }),
    },
  );

  return (
    <AuthCard
      title="Partner with us"
      subtitle="List your restaurant on CampusBite and start receiving orders."
      footer={<p>Already a partner? <Link to="/login" className="link">Log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <ErrorMessage error={formError} />
        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Owner details</legend>
          <FormField label="Full name" error={errors.name}><input value={values.name} onChange={set('name')} autoComplete="name" /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email" error={errors.email}><input type="email" value={values.email} onChange={set('email')} autoComplete="email" /></FormField>
            <FormField label="Phone" error={errors.phone}><input type="tel" value={values.phone} onChange={set('phone')} /></FormField>
          </div>
          <FormField label="Password" error={errors.password} hint="At least 8 characters">
            <input type="password" value={values.password} onChange={set('password')} autoComplete="new-password" />
          </FormField>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Restaurant details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Restaurant name" error={errors['restaurant.name']}><input value={values.r_name} onChange={set('r_name')} /></FormField>
            <FormField label="Cuisine" error={errors['restaurant.cuisine']}><input value={values.r_cuisine} onChange={set('r_cuisine')} placeholder="North Indian" /></FormField>
          </div>
          <FormField label="Address" error={errors['restaurant.address']}><input value={values.r_address} onChange={set('r_address')} placeholder="Food Court, Block A" /></FormField>
          <FormField label="Restaurant phone" error={errors['restaurant.phone']}><input type="tel" value={values.r_phone} onChange={set('r_phone')} /></FormField>
          <FormField label="Description (optional)" error={errors['restaurant.description']}>
            <textarea rows={2} value={values.r_description} onChange={set('r_description')} />
          </FormField>
        </fieldset>
        <Button type="submit" className="w-full" loading={submitting}>Register restaurant</Button>
      </form>
    </AuthCard>
  );
}
