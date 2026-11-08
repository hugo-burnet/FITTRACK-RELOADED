import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './contentSecurityPolicy';

const hash = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

describe('content security policy of the self-hosted client', () => {
  it('allows exactly the inline scripts of the built page, by hash', () => {
    const bootstrap = "document.documentElement.dataset.theme='dark'";
    const policy = contentSecurityPolicy(
      `<head><script>${bootstrap}</script><script type="module" crossorigin src="/assets/a.js"></script></head>`,
    );
    expect(policy).toContain(`script-src 'self' ${hash(bootstrap)};`);
    expect(policy).not.toMatch(/script-src[^;]*unsafe/);
  });
  it('hashes the script text the browser sees, with CRLF normalised to LF', () => {
    // A Windows checkout writes index.html with CRLF; the HTML parser hashes LF.
    const policy = contentSecurityPolicy('<script>\r\nconst a = 1;\r\n</script>');
    expect(policy).toContain(hash('\nconst a = 1;\n'));
  });
  it('confines the page to its own origin and forbids framing', () => {
    const policy = contentSecurityPolicy('<p>no script</p>');
    for (const directive of [
      "default-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "script-src 'self';",
    ])
      expect(policy).toContain(directive);
    expect(policy).not.toContain('"');
  });
});
