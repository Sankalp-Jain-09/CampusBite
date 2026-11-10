import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homePathFor } from '../../utils/constants';

/** Shared form state for login/signup: values, client + server errors, submit with redirect by role. */
export function useAuthForm(initial, { validate, submit, redirectTo }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const clientErrors = validate(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    setSubmitting(true);
    try {
      const user = await submit(values);
      navigate(redirectTo?.(user) || homePathFor(user.role), { replace: true });
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return { values, errors, formError, submitting, set, onSubmit };
}
