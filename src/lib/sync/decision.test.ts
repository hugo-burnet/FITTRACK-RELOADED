import { describe, expect, it } from 'vitest';
import { decideSync } from './decision';

const cursor = { generation: 'generation', revision: 3 };
const anchor = { ...cursor, hash: 'base' };
describe('snapshot reconciliation', () => {
  it('publishes only to an empty server on first opt-in', () => {
    expect(decideSync(null, 'local', { ...cursor, revision: 0 }, null)).toBe('push');
    expect(decideSync(null, 'local', cursor, 'remote')).toBe('conflict');
    expect(decideSync(null, 'local', cursor, 'local')).toBe('same');
  });
  it('distinguishes changes on each side without a silent merge', () => {
    expect(decideSync(anchor, 'base', cursor, 'base')).toBe('same');
    expect(decideSync(anchor, 'local', cursor, 'base')).toBe('push');
    expect(decideSync(anchor, 'base', { ...cursor, revision: 4 }, 'remote')).toBe('pull');
    expect(decideSync(anchor, 'local', { ...cursor, revision: 4 }, 'remote')).toBe('conflict');
    expect(decideSync(anchor, 'remote', { ...cursor, revision: 4 }, 'remote')).toBe('same');
  });
  it('refuses a restored generation, a regressed cursor and inconsistent content', () => {
    expect(decideSync(anchor, 'base', { generation: 'restored', revision: 3 }, 'base')).toBe(
      'conflict',
    );
    expect(decideSync(anchor, 'base', { ...cursor, revision: 2 }, 'base')).toBe('conflict');
    expect(decideSync(anchor, 'base', cursor, 'different')).toBe('conflict');
  });
});
