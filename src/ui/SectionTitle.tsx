/**
 * The engraved register: annotates a group of rows, never narrates. Always
 * --text-2, never --text-3 — at 11px this is content, and #a1a1aa on white is
 * 2.3:1.
 */
export function SectionTitle({ children }: { children: string }) {
  return <h2 className="label-xs mb-3 px-1 font-semibold text-[var(--text-2)]">{children}</h2>;
}
