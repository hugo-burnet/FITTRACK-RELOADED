import type { Anchor, Cursor } from './types';

export function decideSync(
  anchor: Anchor | null,
  localHash: string,
  remote: Cursor,
  remoteHash: string | null,
): 'same' | 'push' | 'pull' | 'conflict' {
  if (anchor === null)
    return remoteHash === null ? 'push' : localHash === remoteHash ? 'same' : 'conflict';
  if (anchor.generation !== remote.generation || remote.revision < anchor.revision)
    return 'conflict';
  if (anchor.revision === remote.revision && anchor.hash !== remoteHash) return 'conflict';
  if (localHash === remoteHash) return 'same';
  if (anchor.revision === remote.revision) return 'push';
  return localHash === anchor.hash ? 'pull' : 'conflict';
}
