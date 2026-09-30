import { describe, expect, it } from 'vitest';
import { validateRegistration } from '../src/features/auth/validation';

describe('registration validation', () => {
  const valid = { username: '  BaTien ', password: 'my-password-123', confirmPassword: 'my-password-123' };
  it('accepts valid input', () => expect(validateRegistration(valid)).toEqual({}));
  it('requires a valid username', () => {
    expect(validateRegistration({ ...valid, username: '' })).toHaveProperty('username');
    expect(validateRegistration({ ...valid, username: 'bátiến' })).toHaveProperty('username');
  });
  it('requires a matching confirmation', () => expect(validateRegistration({ ...valid, confirmPassword: 'different' })).toHaveProperty('confirmPassword'));
  it('enforces password character minimum and byte maximum', () => {
    expect(validateRegistration({ ...valid, password: 'short' })).toHaveProperty('password');
    expect(validateRegistration({ ...valid, password: 'ầ'.repeat(25) })).toHaveProperty('password');
    expect(validateRegistration({ ...valid, password: 'ầ'.repeat(24), confirmPassword: 'ầ'.repeat(24) })).toEqual({});
  });
});
