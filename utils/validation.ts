export interface NumberValidationOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

export interface StringValidationOptions {
  maxLength?: number;
}

export const trimRequired = (
  value: unknown,
  fieldName: string,
  options: StringValidationOptions = {}
): string => {
  const trimmed = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!trimmed) throw new Error(`${fieldName} is required.`);
  if (options.maxLength !== undefined && trimmed.length > options.maxLength) {
    throw new Error(`${fieldName} must be ${options.maxLength} characters or fewer.`);
  }
  return trimmed;
};

export const trimOptional = (
  value: unknown,
  fieldName: string,
  options: StringValidationOptions = {}
): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (options.maxLength !== undefined && trimmed.length > options.maxLength) {
    throw new Error(`${fieldName} must be ${options.maxLength} characters or fewer.`);
  }
  return trimmed;
};

export const finiteNumber = (
  value: unknown,
  fieldName: string,
  options: NumberValidationOptions = {}
): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName} must be a valid number.`);
  if (options.integer && !Number.isInteger(parsed)) throw new Error(`${fieldName} must be a whole number.`);
  if (options.min !== undefined && parsed < options.min) throw new Error(`${fieldName} must be at least ${options.min}.`);
  if (options.max !== undefined && parsed > options.max) throw new Error(`${fieldName} must be at most ${options.max}.`);
  return parsed;
};

export const strictDateString = (value: unknown, fieldName: string): string => {
  const trimmed = trimRequired(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a real calendar date.`);
  }

  return trimmed;
};

export const strictTimeString = (value: unknown, fieldName: string): string => {
  const trimmed = trimRequired(value, fieldName);
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) throw new Error(`${fieldName} must use HH:MM format.`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`${fieldName} must be a valid time.`);
  }
  return trimmed;
};

export const enumValue = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T => {
  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}.`);
  }
  return value as T;
};

export const optionalEnumValue = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T | undefined => {
  if (value === undefined) return undefined;
  return enumValue(value, allowedValues, fieldName);
};