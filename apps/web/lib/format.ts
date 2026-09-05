const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-07" to "7 Oct", as the poster prints it in prose. */
export function dayMonth(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** "2026-10-01" to "01 OCT", zero-padded, for the date range slate. */
export function dayMonthUpper(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d} ${MONTHS[Number(m) - 1]}`.toUpperCase();
}
