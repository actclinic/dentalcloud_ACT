import { describe, expect, it } from 'vitest';

import { resolveAllowedTabs, sanitizeAllowedTabs } from './permissions';

describe('staff tab permissions', () => {
  it('allows normal staff to receive Branch Switching without full Settings', () => {
    const tabs = resolveAllowedTabs('normal', ['dashboard', 'branch-switching', 'settings']);

    expect(tabs).toContain('branch-switching');
    expect(tabs).not.toContain('settings');
  });

  it('sanitizes Branch Switching as a recognized permission', () => {
    expect(sanitizeAllowedTabs(['branch-switching', 'unknown'])).toEqual(['branch-switching']);
  });

  it('does not add the staff-only Branch Switching route to manager full access', () => {
    expect(resolveAllowedTabs('admin', [])).not.toContain('branch-switching');
  });
});
