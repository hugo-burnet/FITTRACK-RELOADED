import { describe, expect, it, vi } from 'vitest';
import { createWebSyncTransport } from './syncTransport';

describe('same-origin sync transport', () => {
  it('sends HttpOnly cookies only to its origin and takes CSRF from the session response', async () => {
    const csrfToken = 'x'.repeat(64);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const transport = createWebSyncTransport('https://fittrack.example', fetcher);
    await transport.request('/api/auth/session');
    await transport.request('/api/auth/login', {
      username: 'alice',
      password: 'never-persist-this',
    });
    const [url, init] = fetcher.mock.calls[1]!;
    expect(url).toBe('https://fittrack.example/api/auth/login');
    expect(init.credentials).toBe('same-origin');
    expect(init.redirect).toBe('error');
    expect(init.cache).toBe('no-store');
    expect(init.headers['X-CSRFToken']).toBe(csrfToken);
    expect(init.headers.Cookie).toBeUndefined();
    expect(localStorage.getItem('password')).toBeNull();
  });
  it('refuses insecure origins, wrong routes and a mutation before CSRF bootstrap', async () => {
    expect(() => createWebSyncTransport('http://public.example', vi.fn())).toThrow();
    const fetcher = vi.fn();
    const transport = createWebSyncTransport('https://fittrack.example', fetcher);
    await expect(transport.request('/api/auth/login', {})).rejects.toMatchObject({
      code: 'csrf_required',
    });
    await expect(transport.request('/api/auth/session', {})).rejects.toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports server errors and refuses malformed or oversized responses', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"too_many_attempts"}', { status: 429 }))
      .mockResolvedValueOnce(new Response('<html>not the API</html>', { status: 200 }))
      .mockResolvedValueOnce(
        new Response('{}', { status: 200, headers: { 'content-length': '99999999' } }),
      );
    const transport = createWebSyncTransport('https://fittrack.example', fetcher);
    await expect(transport.request('/api/auth/session')).rejects.toMatchObject({
      code: 'too_many_attempts',
    });
    await expect(transport.request('/api/auth/session')).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(transport.request('/api/auth/session')).rejects.toMatchObject({
      code: 'response_too_large',
    });
  });
});
