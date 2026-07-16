import { beforeEach, describe, expect, it, vi } from 'vitest';

const presenceMock = vi.hoisted(() => ({
  markActive: vi.fn(),
  markInactive: vi.fn()
}));

vi.mock('./activeStaffPresence', () => ({
  activeStaffPresence: presenceMock
}));

vi.mock('./api', () => ({
  api: {
    users: {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      authenticate: vi.fn()
    }
  }
}));

import { auth } from './auth';
import { api } from './api';

const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    })
  };
};

describe('auth staff session presence resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', createLocalStorageMock());
    presenceMock.markActive.mockReset();
    presenceMock.markInactive.mockReset();
  });

  it('keeps a valid staff session when active presence tracking fails', async () => {
    presenceMock.markActive.mockRejectedValueOnce(new Error('RPC unavailable'));

    const session = await auth.createStaffSession({
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      location_id: null
    });

    expect(session.username).toBe('admin');
    expect(auth.getSession()?.username).toBe('admin');
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('dental_auth_session');
  });

  it('clears the local session even when inactive presence tracking fails during logout', async () => {
    presenceMock.markActive.mockResolvedValueOnce(undefined);
    presenceMock.markInactive.mockRejectedValueOnce(new Error('RPC unavailable'));

    await auth.createStaffSession({
      id: '00000000-0000-0000-0000-000000000002',
      username: 'frontdesk',
      password: 'secret',
      role: 'normal',
      location_id: null
    });

    await auth.logout();

    expect(auth.getSession()).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('dental_auth_session');
  });

  it('refreshes branch permission changes from the database without requiring a new login', async () => {
    presenceMock.markActive.mockResolvedValueOnce(undefined);
    await auth.createStaffSession({
      id: '00000000-0000-0000-0000-000000000003',
      username: 'marketing',
      password: 'secret',
      role: 'normal',
      location_id: null,
      allowed_tabs: ['dashboard']
    });

    vi.mocked(api.users.getById).mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000003',
      username: 'marketing',
      password: '',
      role: 'normal',
      location_id: null,
      allowed_tabs: ['dashboard', 'branch-switching']
    });

    const refreshed = await auth.refreshStaffSession();

    expect(refreshed?.allowed_tabs).toContain('branch-switching');
    expect(auth.getSession()?.allowed_tabs).toContain('branch-switching');
  });

  it('clears a cached session when the staff account was deleted', async () => {
    presenceMock.markActive.mockResolvedValueOnce(undefined);
    presenceMock.markInactive.mockResolvedValueOnce(undefined);
    await auth.createStaffSession({
      id: '00000000-0000-0000-0000-000000000004',
      username: 'removed-user',
      password: 'secret',
      role: 'normal',
      location_id: null
    });
    vi.mocked(api.users.getById).mockResolvedValueOnce(null);

    await expect(auth.refreshStaffSession()).resolves.toBeNull();
    expect(auth.getSession()).toBeNull();
  });
});
