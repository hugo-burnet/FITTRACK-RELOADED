/**
 * The engraved register: annotates a group of rows, never narrates. Always
 * --text-2, never --text-3: at `label-xs` (12 px, uppercase) this is content,
 * and the low-contrast --text-3 does not reach a readable ratio on the light
 * theme.
 */
export function SectionTitle({ children }: { children: string }) {
  return <h2 className="label-xs mb-3 px-1 font-semibold text-[var(--text-2)]">{children}</h2>;
}
