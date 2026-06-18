import type { PaymentMethod } from '../types';

export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'KPAY', label: 'KPay' },
  { value: 'WAVEPAY', label: 'WavePay' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MMQR', label: 'MMQR' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'AYA_PAY', label: 'AYA Pay' },
  { value: 'UAB_PAY', label: 'UAB Pay' }
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  KPAY: 'KPay',
  WAVEPAY: 'WavePay',
  CASH: 'Cash',
  MMQR: 'MMQR',
  DEBIT_CARD: 'Debit Card',
  CREDIT_CARD: 'Credit Card',
  AYA_PAY: 'AYA Pay',
  UAB_PAY: 'UAB Pay',
  UNKNOWN: 'Unknown'
};

const PAYMENT_METHOD_ALIASES: Record<string, PaymentMethod> = {
  KPAY: 'KPAY',
  KBZPAY: 'KPAY',
  KBZ_PAY: 'KPAY',
  WAVEPAY: 'WAVEPAY',
  WAVE_PAY: 'WAVEPAY',
  CASH: 'CASH',
  MMQR: 'MMQR',
  MM_QR: 'MMQR',
  DEBIT: 'DEBIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  CREDIT: 'CREDIT_CARD',
  CREDIT_CARD: 'CREDIT_CARD',
  AYAPAY: 'AYA_PAY',
  AYA_PAY: 'AYA_PAY',
  UABPAY: 'UAB_PAY',
  UAB_PAY: 'UAB_PAY',
  UNKNOWN: 'UNKNOWN'
};

export const formatPaymentMethod = (method?: PaymentMethod | null): string =>
  PAYMENT_METHOD_LABELS[method || 'UNKNOWN'];

export const normalizePaymentMethod = (value: unknown): PaymentMethod => {
  if (typeof value !== 'string') return 'UNKNOWN';
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return PAYMENT_METHOD_ALIASES[normalized] || 'UNKNOWN';
};

export const isSelectablePaymentMethod = (method: PaymentMethod): boolean => method !== 'UNKNOWN';
