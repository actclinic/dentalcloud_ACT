import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AssistantDataStatus from './AssistantDataStatus';

describe('Assistant data readiness status', () => {
  it('blocks sending while explaining that drafting remains available', () => {
    const html = renderToStaticMarkup(<AssistantDataStatus ready={false} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('draft a message');
  });

  it('renders escaped failures with a retry control', () => {
    const html = renderToStaticMarkup(<AssistantDataStatus ready={false} error="<script>failed</script>" onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('&lt;script&gt;failed&lt;/script&gt;');
    expect(html).toContain('Retry');
  });

  it('renders nothing when the dataset is ready', () => {
    expect(renderToStaticMarkup(<AssistantDataStatus ready />)).toBe('');
  });
});
