import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./AIAssistantView.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

describe('Loli mobile layout guards', () => {
  it('sizes the workspace from the visible viewport and app header', () => {
    expect(app).toContain('data-mobile-app-header');
    expect(source).toContain('window.visualViewport');
    expect(source).toContain("viewport?.addEventListener('resize', updateHeight)");
    expect(source).toContain("viewport?.removeEventListener('resize', updateHeight)");
    expect(source).toContain('h-[var(--loli-mobile-height,100dvh)]');
  });

  it('keeps messages and the composer shrinkable on phones', () => {
    expect(source).toContain('aria-label="Chat messages"');
    expect(source).toContain('loli-composer-actions flex w-full flex-row');
    expect(source).toContain('aria-label="Message Loli"');
    expect(source).toContain('min-h-[60px] sm:min-h-[72px] min-w-0');
    expect(source).toContain('env(safe-area-inset-bottom)');
  });

  it('provides touch targets, visible focus, and reduced motion', () => {
    expect(source).toContain('.loli-workspace button { min-height: 44px; }');
    expect(source).toContain('.loli-workspace button:focus-visible');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
