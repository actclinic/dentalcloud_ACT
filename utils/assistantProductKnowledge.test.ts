import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_PRODUCT_KNOWLEDGE,
  ASSISTANT_PRODUCT_KNOWLEDGE_VERSION
} from './assistantProductKnowledge';

describe('assistant product knowledge', () => {
  it('documents the current payment and immutable receipt workflow', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE_VERSION).toBe('2026-07-20');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Every payment requires one supported payment type');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('split across multiple distinct supported payment types');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('allocations must exactly equal the amount received');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('not a payment type staff can select');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('submission key');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('immutable receipt snapshot');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('treatment and medicine lines');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('today in the clinic');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('80 mm thermal');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Payment corrections are admin-only');
  });

  it('documents per-visit fees and the removal of appointment target teeth', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('not charged during patient registration');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('new-patient and returning-patient');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Appointments no longer collect target teeth');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Only skip or waive the fee when the user explicitly requests it');
  });

  it('documents current appointment, patient list, and audit workflows', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Scheduled first, Completed second, Cancelled last');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('New Patient/lead appointments should keep guest fields');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Recalls & Cancels is read-only reporting');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Created Date');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Last Visit');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('future or impossible dates are rejected');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('must never directly change balance or loyalty points');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('deleting a patient is blocked by related records');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('payment correction access is limited to admins');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Patient Type and Service Charges');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('serviceFeeAmount first');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Do not treat treatment Amount or Patient Balance as Service Charges');
  });

  it('documents new clinical focus and patient summary workflows', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain("selected patient's Medicine History, newest first");
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Arrow Up/Down');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('"About this patient" live summary');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('describe total paid as unavailable, never as zero');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Unregistered lead appointments have no patient chart');
  });

  it('documents material, lab, and branch permission workflows', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('keeps material and lab items/totals separate');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('does not ask them to re-enter an admin password');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Material Cost or Lab Cost expense records');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('dedicated Branch Switching permission without receiving full Settings access');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('previous branch remains active');
  });

  it('prevents unsupported action claims and financial category confusion', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Distinguish guidance from execution');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('matching exposed action actually ran');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Never substitute one for another');
  });
});
