import { describe, expect, it } from 'vitest';

import {
  getReceiptPageSize,
  getReceiptPrintPosition,
  getThermalPageHeightMm,
  getThermalPaperWidthMm,
  THERMAL_PAGE_SAFETY_MM
} from './receiptPrint';

describe('receipt print sizing', () => {
  it('keeps A4 printing on A4 paper', () => {
    expect(getReceiptPageSize('A4', 400)).toBe('A4');
  });

  it('uses the physical roll width for both thermal formats', () => {
    expect(getThermalPaperWidthMm('THERMAL_55MM')).toBe(58);
    expect(getThermalPaperWidthMm('THERMAL_80MM')).toBe(80);
  });

  it('anchors thermal receipts to page one without fixed paged-media positioning', () => {
    expect(getReceiptPrintPosition('THERMAL_55MM')).toBe('absolute');
    expect(getReceiptPrintPosition('THERMAL_80MM')).toBe('absolute');
    expect(getReceiptPrintPosition('A4')).toBe('static');
  });

  it('sizes a thermal page to its rendered content instead of a fixed A4 height', () => {
    // 960 CSS px is 10 inches / 254 mm. The result includes only cutter safety.
    expect(getThermalPageHeightMm(960)).toBe(254 + THERMAL_PAGE_SAFETY_MM);
    expect(getReceiptPageSize('THERMAL_80MM', getThermalPageHeightMm(960))).toBe('80mm 256mm');
  });

  it('guards invalid or empty measurements with a small valid page', () => {
    expect(getThermalPageHeightMm(Number.NaN)).toBe(20);
    expect(getReceiptPageSize('THERMAL_55MM', Number.POSITIVE_INFINITY)).toBe('58mm 20mm');
  });
});