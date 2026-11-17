import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../supabase/functions/credential-auth/index.ts', import.meta.url),
  'utf8'
);

describe('credential-auth CORS policy', () => {
  it('echoes only a configured application origin', () => {
    expect(source).toContain("Deno.env.get('AUTH_ALLOWED_ORIGINS')");
    expect(source).toContain('allowedOrigins.has(origin)');
    expect(source).toContain("'Access-Control-Allow-Origin': origin");
    expect(source).not.toContain("'Access-Control-Allow-Origin': '*'");
  });

  it('rejects preflight requests from unrecognized origins', () => {
    expect(source).toContain("req.method==='OPTIONS'");
    expect(source).toContain('? 200 : 403');
  });

  it('rejects requests carrying an unrecognized Origin header', () => {
    expect(source).toContain('if(requestOrigin && !allowedOrigins.has(requestOrigin))');
    expect(source).toContain("reply({error:'Unrecognized application origin'},403)");
  });
});
