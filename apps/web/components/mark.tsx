/** The Arc mark. Paths are brand/mark.svg verbatim (a 760 x 380 box); see brand/README.md before changing them. */
export function Mark({ height = 18, ink = 'var(--p-ink)', className }: { height?: number; ink?: string; className?: string }) {
  return (
    <svg viewBox="0 0 760 380" height={height} width={height * 2} aria-hidden="true" focusable="false" className={className}>
      <path d="M 0 380 A 380 380 0 0 1 760 380 Z" fill="var(--p-ember)" />
      <path d="M 87.99 136.84 L 222.77 380 L 278.72 380 L 380 85.86 L 481.28 380 L 537.23 380 L 672.01 136.84 A 380 380 0 0 0 589.48 62.96 L 525.86 177.74 L 468.23 10.39 A 380 380 0 0 0 291.77 10.39 L 234.14 177.74 L 170.52 62.96 A 380 380 0 0 0 87.99 136.84 Z" fill={ink} />
    </svg>
  );
}
