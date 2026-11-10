export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?\d{10,15}$/;

export function required(value, label) {
  return String(value ?? '').trim() ? null : `${label} is required`;
}

export function validateEmail(value) {
  if (!String(value || '').trim()) return 'Email is required';
  return EMAIL_RE.test(value.trim()) ? null : 'Enter a valid email address';
}

export function validatePhone(value) {
  if (!String(value || '').trim()) return 'Phone is required';
  return PHONE_RE.test(value.trim()) ? null : 'Enter 10–15 digits (optionally starting with +)';
}

export function validatePassword(value) {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Use at least 8 characters';
  if (value.length > 72) return 'Use at most 72 characters';
  return null;
}

export function minLength(value, n, label) {
  return String(value || '').trim().length >= n ? null : `${label} must be at least ${n} characters`;
}

/** Run validators: { field: errorOrNull } → only the failing fields. */
export function collectErrors(checks) {
  return Object.fromEntries(Object.entries(checks).filter(([, err]) => Boolean(err)));
}
