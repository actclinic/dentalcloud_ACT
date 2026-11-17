import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_KEYS = [
  'ACT_ENVIRONMENT',
  'ACT_APP_ORIGIN',
  'ACT_SUPABASE_URL',
  'AUTH_ALLOWED_ORIGINS',
  'VITE_DATABASE_FILTERED_DIRECTORIES',
];

const FORBIDDEN_FRONTEND_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'POSTGRES_PASSWORD',
  'DATABASE_PASSWORD',
  'RESEND_API_KEY',
];

export function parseEnvironmentFile(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error('Environment file contains an invalid assignment.');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (Object.hasOwn(values, key)) throw new Error(`Environment key is duplicated: ${key}`);
    values[key] = value;
  }
  return values;
}

const parseUrl = (value, label, protocols = ['https:']) => {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error(`${label} must be a valid absolute URL.`); }
  if (!protocols.includes(parsed.protocol)) throw new Error(`${label} uses an unsupported protocol.`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} must not contain credentials, query parameters, or fragments.`);
  }
  return parsed;
};

const isLoopback = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(hostname);
const containsPlaceholder = (value) => /REPLACE_|<[^>]+>|YOUR[_-]/i.test(value);

export function validateEnvironment(values) {
  const errors = [];
  let hasMissingRequiredKey = false;
  for (const key of REQUIRED_KEYS) {
    if (!values[key]) {
      errors.push(`${key} is required.`);
      hasMissingRequiredKey = true;
    }
  }

  for (const key of Object.keys(values)) {
    if (FORBIDDEN_FRONTEND_KEYS.includes(key) || (/^VITE_/i.test(key) && /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/i.test(key))) {
      errors.push(`${key} is forbidden in a frontend environment file.`);
    }
  }

  if (hasMissingRequiredKey) return errors;

  const environment = values.ACT_ENVIRONMENT;
  if (!['local', 'staging', 'production'].includes(environment)) {
    errors.push('ACT_ENVIRONMENT must be local, staging, or production.');
  }

  if (Object.values(values).some((value) => typeof value === 'string' && /mydentist/i.test(value))) {
    errors.push('ACT configuration must not reference a Mydentist domain or value.');
  }

  if (Object.values(values).some((value) => typeof value === 'string' && containsPlaceholder(value))) {
    errors.push('Replace every REPLACE_* placeholder before validation.');
    return errors;
  }

  let appOrigin;
  let supabaseUrl;
  try {
    appOrigin = parseUrl(values.ACT_APP_ORIGIN, 'ACT_APP_ORIGIN', environment === 'local' ? ['http:', 'https:'] : ['https:']);
    supabaseUrl = parseUrl(values.ACT_SUPABASE_URL, 'ACT_SUPABASE_URL', ['https:']);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Invalid URL configuration.');
    return errors;
  }

  if (appOrigin.pathname !== '/') errors.push('ACT_APP_ORIGIN must not include a path.');
  if (environment === 'local' && !isLoopback(appOrigin.hostname)) errors.push('Local ACT_APP_ORIGIN must use a loopback host.');
  if (environment !== 'local' && isLoopback(appOrigin.hostname)) errors.push('Staging/production ACT_APP_ORIGIN cannot use a loopback host.');

  const allowedOrigins = values.AUTH_ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
  const normalizedAllowedOrigins = [];
  for (const origin of allowedOrigins) {
    try {
      const parsed = parseUrl(origin, 'AUTH_ALLOWED_ORIGINS entry', environment === 'local' ? ['http:', 'https:'] : ['https:']);
      if (parsed.pathname !== '/') errors.push('AUTH_ALLOWED_ORIGINS entries must not include paths.');
      normalizedAllowedOrigins.push(parsed.origin);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Invalid allowed origin.');
    }
  }
  if (!normalizedAllowedOrigins.includes(appOrigin.origin)) errors.push('AUTH_ALLOWED_ORIGINS must include ACT_APP_ORIGIN.');

  const productionApp = 'https://act.dentalcloud.asia';
  const productionSupabase = 'https://supabaseact.dentalcloud.asia';
  if (environment === 'production') {
    if (appOrigin.origin !== productionApp) errors.push(`Production ACT_APP_ORIGIN must be ${productionApp}.`);
    if (supabaseUrl.origin !== productionSupabase) errors.push(`Production ACT_SUPABASE_URL must be ${productionSupabase}.`);
  } else {
    if (appOrigin.origin === productionApp) errors.push('Local/staging configuration cannot use the production ACT origin.');
    if (supabaseUrl.origin === productionSupabase) errors.push('Local/staging configuration cannot use the production Supabase backend.');
  }

  if (!['true', 'false'].includes(values.VITE_DATABASE_FILTERED_DIRECTORIES)) {
    errors.push('VITE_DATABASE_FILTERED_DIRECTORIES must be true or false.');
  }

  return errors;
}

export function validateEnvironmentFile(filePath) {
  const absolutePath = resolve(filePath);
  const values = parseEnvironmentFile(readFileSync(absolutePath, 'utf8'));
  const errors = validateEnvironment(values);
  if (errors.length) throw new Error(errors.join('\n'));
  return absolutePath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const filePath = process.argv[2] || '.env.local';
  try {
    validateEnvironmentFile(filePath);
    console.log(`Environment configuration is valid: ${filePath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Environment validation failed.');
    process.exitCode = 1;
  }
}
