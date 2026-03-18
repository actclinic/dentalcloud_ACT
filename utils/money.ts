import { Currency } from './currency';

const currencyScale = (currency: Currency): number => (currency === 'MMK' ? 0 : 2);

const normalizeAmount = (amount: number, scale: number): string => {
  if (!Number.isFinite(amount)) {
    return '0';
  }

  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const raw = abs.toString();
  const parts = raw.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts[1] || '';

  if (scale === 0) {
    return `${sign}${intPart}`;
  }

  const frac = fracPart.padEnd(scale, '0').slice(0, scale);
  return `${sign}${intPart}.${frac}`;
};

export const toMinorUnits = (amount: number, currency: Currency): bigint => {
  const scale = currencyScale(currency);
  const normalized = normalizeAmount(amount, scale);
  const sign = normalized.startsWith('-') ? -1n : 1n;
  const unsigned = normalized.replace('-', '');
  const parts = unsigned.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts[1] || '';

  const combined = scale === 0 ? intPart : `${intPart}${fracPart.padEnd(scale, '0')}`;
  const minor = combined.length > 0 ? BigInt(combined) : 0n;
  return minor * sign;
};

export const fromMinorUnits = (minor: bigint, currency: Currency): number => {
  const scale = currencyScale(currency);
  if (scale === 0) {
    return Number(minor);
  }

  const sign = minor < 0n ? -1 : 1;
  const abs = minor < 0n ? -minor : minor;
  const factor = BigInt(Math.pow(10, scale));
  const intPart = abs / factor;
  const fracPart = abs % factor;
  const fracStr = fracPart.toString().padStart(scale, '0');
  const numStr = `${intPart.toString()}.${fracStr}`;
  return Number(numStr) * sign;
};

export const sumMoney = (amounts: Array<number | null | undefined>, currency: Currency): number => {
  const totalMinor = amounts.reduce((acc, amount) => {
    return acc + toMinorUnits(amount || 0, currency);
  }, 0n);
  return fromMinorUnits(totalMinor, currency);
};

export const multiplyMoney = (amount: number, quantity: number, currency: Currency): number => {
  const qty = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  const minor = toMinorUnits(amount || 0, currency) * BigInt(qty);
  return fromMinorUnits(minor, currency);
};
