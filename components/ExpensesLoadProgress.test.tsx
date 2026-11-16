import { describe, expect, it } from 'vitest';
import { createExpenseLoadStages } from './ExpensesLoadProgress';

describe('ExpensesLoadProgress', () => {
  it('starts all measured datasets in a pending state', () => {
    expect(createExpenseLoadStages()).toEqual([
      { label: 'Expenses and derived material costs', count: null },
      { label: 'Medicine sales', count: null },
      { label: 'Treatment revenue', count: null }
    ]);
  });

  it('returns a fresh set for each load', () => {
    const first = createExpenseLoadStages();
    first[0].count = 12;
    expect(createExpenseLoadStages()[0].count).toBeNull();
  });
});
