import { describe, expect, it } from 'vitest';
import { cleanParams, normalizeError } from '../api/client';

describe('normalizeError', () => {
  it('handles network errors', () => {
    expect(normalizeError({}).status).toBe(0);
  });

  it('uses a string detail as the message', () => {
    const e = normalizeError({ response: { status: 409, data: { detail: 'Order can no longer be cancelled' }, headers: {} } });
    expect(e).toMatchObject({ status: 409, message: 'Order can no longer be cancelled' });
  });

  it('maps FastAPI 422 details to field errors', () => {
    const e = normalizeError({
      response: {
        status: 422,
        headers: {},
        data: { detail: [
          { loc: ['body', 'email'], msg: 'value is not a valid email address' },
          { loc: ['body', 'restaurant', 'name'], msg: 'Value error, name cannot be null' },
        ] },
      },
    });
    expect(e.fieldErrors).toEqual({ email: 'value is not a valid email address', 'restaurant.name': 'name cannot be null' });
  });

  it('exposes Retry-After for 429', () => {
    const e = normalizeError({ response: { status: 429, data: { detail: 'Too many' }, headers: { 'retry-after': '12' } } });
    expect(e.retryAfter).toBe('12');
  });
});

describe('cleanParams', () => {
  it('drops empty values', () => {
    expect(cleanParams({ a: '', b: null, c: undefined, d: 0, e: 'x', f: false })).toEqual({ d: 0, e: 'x', f: false });
  });
});
