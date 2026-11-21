type Height =
  | 'h-14'
  | 'h-16'
  | 'h-20'
  | 'h-24'
  | 'h-28'
  | 'h-40'
  | 'h-44'
  | 'h-52'
  | 'h-64'
  | 'h-72'
  | 'h-80';

type Props = {
  /** Literal classes, so Tailwind finds them in the source. */
  height: Height;
  /** `plate` is the shape of a `Card`; `row` is one line of a sheet. */
  shape?: 'plate' | 'row';
};

/**
 * The place kept for what is still being read. Reads are local and answer in a few
 * milliseconds, so a pulse would never complete a cycle: it would only blink. What informs is
 * the reserved space, which keeps the screen from jumping. Hence no animation, deliberately.
 * The plate carries the same classes as `Card`, which is how the TTY1 and Cyber themes
 * recognise it as a card. The zone that waits carries `aria-busy="true"`.
 */
export function Skeleton({ height, shape = 'plate' }: Props) {
  const form =
    shape === 'row' ? 'border-b border-[var(--border)]' : 'rounded-2xl bg-[var(--surface-1)]';
  return <div aria-hidden="true" className={`${height} ${form}`} />;
}
