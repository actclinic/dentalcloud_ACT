import { describe, expect, it } from 'vitest';
import { parseEnvironmentFile, validateEnvironment } from './validate-environment.mjs';

const validProduction = {
  ACT_ENVIRONMENT: 'production',
  ACT_APP_ORIGIN: 'https://act.dentalcloud.asia',
  ACT_SUPABASE_URL: 'https://supabaseact.dentalcloud.asia',
  AUTH_ALLOWED_ORIGINS: 'https://act.dentalcloud.asia',
  VITE_DATABASE_FILTERED_DIRECTORIES: 'true',
};

describe('environment configuration validation', () => {
  it('accepts the exact ACT production domains', () => {
    expect(validateEnvironment(validProduction)).toEqual([]);
  });

  it('rejects Mydentist references and frontend secrets', () => {
    const errors = validateEnvironment({
      ...validProduction,
      ACT_APP_ORIGIN: 'https://mydentist.dentalcloud.asia',
      AUTH_ALLOWED_ORIGINS: 'https://mydentist.dentalcloud.asia',
      VITE_SERVICE_ROLE_TOKEN: 'not-a-real-secret',
    });
    expect(errors.join(' ')).toContain('Mydentist');
    expect(errors.join(' ')).toContain('VITE_SERVICE_ROLE_TOKEN');
  });

  it('prevents local or staging config from targeting production data', () => {
    const errors = validateEnvironment({
      ...validProduction,
      ACT_ENVIRONMENT: 'staging',
      ACT_APP_ORIGIN: 'https://staging-act.dentalcloud.asia',
      AUTH_ALLOWED_ORIGINS: 'https://staging-act.dentalcloud.asia',
    });
    expect(errors).toContain('Local/staging configuration cannot use the production Supabase backend.');
  });

  it('requires the application origin in the Edge Function allowlist', () => {
    const errors = validateEnvironment({
      ...validProduction,
      AUTH_ALLOWED_ORIGINS: 'https://another.example',
    });
    expect(errors).toContain('AUTH_ALLOWED_ORIGINS must include ACT_APP_ORIGIN.');
  });

  it('parses comments, quotes, and values containing equals signs', () => {
    expect(parseEnvironmentFile('# comment\nONE="a=b"\nTWO=value\n')).toEqual({ ONE: 'a=b', TWO: 'value' });
  });

  it('rejects duplicate keys without printing their values', () => {
    expect(() => parseEnvironmentFile('ONE=first\nONE=second')).toThrow('Environment key is duplicated: ONE');
  });
});
