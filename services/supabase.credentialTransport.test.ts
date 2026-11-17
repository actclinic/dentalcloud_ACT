import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ config: null as any }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((_url, _key, config) => { captured.config = config; return {}; }),
}));
import './supabase';

describe('production Supabase credential transport wiring', () => {
  it('installs credential-safe fetch on the actual client configuration', () => {
    expect(captured.config.global?.fetch).toBeTypeOf('function');
  });
});
