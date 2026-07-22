import type { ButtonHTMLAttributes } from 'react';

type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANTS = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-accent-fg)] active:bg-[var(--color-accent-dim)]',
  secondary: 'bg-[var(--surface-2)] text-[var(--text-1)] active:brightness-125',
  ghost: 'bg-transparent text-[var(--text-2)] active:bg-[var(--surface-1)]',
  // Ink, not the fill: this variant is red text on a surface. Cf. index.css.
  danger: 'bg-transparent text-[var(--danger-ink)] active:bg-[var(--surface-1)]',
} as const;

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...rest
}: Props) {
  // min-h-12 = 48px : cible tactile minimale, non négociable.
  const sizes = size === 'lg' ? 'min-h-14 px-6 text-lg' : 'min-h-12 px-4 text-base';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold
        transition-[filter,background-color,transform] duration-[var(--dur-1)] ease-[var(--ease-mech)]
        active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40
        ${VARIANTS[variant]} ${sizes} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
}
