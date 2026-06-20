import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_PRODUCT_KNOWLEDGE,
  ASSISTANT_PRODUCT_KNOWLEDGE_VERSION
} from './assistantProductKnowledge';

describe('assistant product knowledge', () => {
  it('documents the current payment and immutable receipt workflow', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE_VERSION).toBe('2026-06-20');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Every payment requires one supported payment type');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('immutable receipt snapshot');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('treatment and medicine lines');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('today in the clinic');
  });

  it('documents per-visit fees and the removal of appointment target teeth', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('not charged during patient registration');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('new-patient and returning-patient');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Appointments no longer collect target teeth');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Only skip or waive the fee when the user explicitly requests it');
  });
});
