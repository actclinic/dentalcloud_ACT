import type { ReceiptSize } from '../types';

const CSS_PIXELS_PER_INCH = 96;
const MILLIMETRES_PER_INCH = 25.4;

// Leave enough paper for browser rounding and the printer cutter without
// recreating the large fixed-height tail that roll printers previously fed.
export const THERMAL_PAGE_SAFETY_MM = 2;

export const getThermalPaperWidthMm = (receiptSize: ReceiptSize): 58 | 80 =>
  receiptSize === 'THERMAL_80MM' ? 80 : 58;

// Fixed-position elements are treated as repeating page furniture by paged
// media engines. Use the first page's origin for roll receipts while keeping
// the multi-page A4 document in normal flow.
export const getReceiptPrintPosition = (receiptSize: ReceiptSize): 'absolute' | 'static' =>
  receiptSize === 'A4' ? 'static' : 'absolute';

export const getThermalPageHeightMm = (contentHeightPx: number): number => {
  const safeHeightPx = Number.isFinite(contentHeightPx) ? Math.max(0, contentHeightPx) : 0;
  const contentHeightMm = (safeHeightPx / CSS_PIXELS_PER_INCH) * MILLIMETRES_PER_INCH;

  return Math.max(20, Math.ceil(contentHeightMm + THERMAL_PAGE_SAFETY_MM));
};

export const getReceiptPageSize = (receiptSize: ReceiptSize, thermalPageHeightMm: number): string => {
  if (receiptSize === 'A4') return 'A4';

  const safeHeightMm = Number.isFinite(thermalPageHeightMm)
    ? Math.max(20, Math.ceil(thermalPageHeightMm))
    : 20;

  return `${getThermalPaperWidthMm(receiptSize)}mm ${safeHeightMm}mm`;
};