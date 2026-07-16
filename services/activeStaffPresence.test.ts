import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn()
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock
}));

import { activeStaffPresence } from './activeStaffPresence';

describe('active staff branch presence', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.rpc.mockResolvedValue({ error: null });
  });

  it('records the selected active branch without changing the account assignment', async () => {
    await activeStaffPresence.markActive({
      userId: 'staff-1',
      username: 'marketing',
      role: 'normal',
      location_id: null,
      loginTime: Date.parse('2026-07-16T08:00:00.000Z'),
      clientSessionId: 'session-1'
    }, 'branch-2');

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'update_and_get_staff_presence',
      expect.objectContaining({
        p_user_id: 'staff-1',
        p_location_id: 'branch-2'
      })
    );
  });
});
