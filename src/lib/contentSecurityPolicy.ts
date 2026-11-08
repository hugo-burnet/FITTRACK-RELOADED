import { createHash } from 'node:crypto';

/** An inline script is a <script> element without a src attribute. */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

/**
 * Build-time only (vite.config.ts): the policy the homelab proxy and the E2E
 * preview both send. The client shares its origin with the account API, so a
 * script injection would act with the session cookies; only this page's own
 * inline bootstrap script is allowed, by hash, and nothing may frame the page.
 */
export function contentSecurityPolicy(html: string): string {
  // The HTML parser turns CRLF and lone CR into LF before the browser hashes a script.
  const inline = [...html.replace(/\r\n?/g, '\n').matchAll(INLINE_SCRIPT)].map(
    (match) =>
      `'sha256-${createHash('sha256')
        .update(match[1] ?? '')
        .digest('base64')}'`,
  );
  return (
    [
      "default-src 'self'",
      ['script-src', "'self'", ...inline].join(' '),
      "style-src 'self'",
      // Inline style attributes cannot run code; some components set them.
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ') + ';'
  );
}
