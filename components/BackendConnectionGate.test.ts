import { describe, expect, it } from 'vitest';
import { CONNECTION_LOSS_GRACE_MS, shouldShowConnectionGate } from './BackendConnectionGate';

describe('BackendConnectionGate', () => {
  it('waits 10 continuous seconds before a disconnected backend can block the app', () => {
    expect(CONNECTION_LOSS_GRACE_MS).toBe(10_000);
    expect(shouldShowConnectionGate('disconnected', false)).toBe(false);
    expect(shouldShowConnectionGate('disconnected', true)).toBe(true);
  });

  it('never blocks a connected or checking backend', () => {
    expect(shouldShowConnectionGate('connected', true)).toBe(false);
    expect(shouldShowConnectionGate('checking', true)).toBe(false);
  });
});