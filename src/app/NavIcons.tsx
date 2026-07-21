import type { SVGProps } from 'react';

/**
 * Hand-drawn on a single 24px grid, 2px strokes, currentColor. Drawn from the
 * gym's own hardware rather than a generic icon set: a bar, a plate, load
 * sliders. No icon library — the architecture rules out third-party UI.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Accueil — a loaded barbell: the thing you are here to do. */
export function BarbellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 12h8" />
      <path d="M6.5 8.5v7" />
      <path d="M17.5 8.5v7" />
      <path d="M3.5 10.5v3" />
      <path d="M20.5 10.5v3" />
    </Icon>
  );
}

/** Routines — a planned sequence: a marker and a line per exercise. */
export function ProgramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="7" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1.4" fill="currentColor" stroke="none" />
      <path d="M10 7h10" />
      <path d="M10 12h10" />
      <path d="M10 17h6" />
    </Icon>
  );
}

/** Historique — the month grid of the Lot 7 calendar, with training days marked. */
export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5.5" width="18" height="15" rx="2.5" />
      <path d="M8 3v5" />
      <path d="M16 3v5" />
      <path d="M3 11h18" />
      <circle cx="8" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Exercices — a weight plate seen face-on. */
export function PlateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.5" />
    </Icon>
  );
}

/**
 * "This row opens a screen". The one mark here that is not gym hardware,
 * because it names an interface move rather than an object — but it is still
 * drawn on the same grid, at the same stroke, rather than borrowing a "›" from
 * whatever font happens to be loaded.
 */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon width="20" height="20" {...props}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Icon>
  );
}

/** Réglages — load sliders, not a gear: this screen is a panel of numbers. */
export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8h12" />
      <path d="M19 8h2" />
      <path d="M3 16h4" />
      <path d="M11 16h10" />
      <circle cx="17" cy="8" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="16" r="2.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}
