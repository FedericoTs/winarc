'use client';
import { useEffect, useState } from 'react';
import { dayOfSeason, localISODate, type Season } from '@winarc/domain';

type State = { phase: 'before'; days: number; clock: string } | { phase: 'live'; day: number; clock: string } | { phase: 'after' };

const pad = (n: number) => String(n).padStart(2, '0');
const hms = (ms: number) => `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}`;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dayMonth = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function compute(now: Date, season: Season): State {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localISODate(now, tz);
  const day = dayOfSeason(today, season);
  if (day > season.arcDays) return { phase: 'after' };
  if (day >= 1) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { phase: 'live', day, clock: hms(Math.max(0, end.getTime() - now.getTime())) };
  }
  const [y, m, d] = season.startsOn.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  const left = Math.max(0, start.getTime() - now.getTime());
  const days = Math.floor(left / 86_400_000);
  return { phase: 'before', days, clock: hms(left - days * 86_400_000) };
}

/** The prototype's first screen: one number, one clock. The season comes from the server page, the clock runs on the client. */
export function Countdown({ season }: { season: Season }) {
  const [s, setS] = useState<State | null>(null);
  useEffect(() => {
    setS(compute(new Date(), season));
    const id = setInterval(() => setS(compute(new Date(), season)), 1000);
    return () => clearInterval(id);
  }, [season]);

  const range = `${dayMonth(season.startsOn)} → ${dayMonth(season.finaleOn)} ${season.finaleOn.slice(0, 4)}`;
  if (!s) return <Hero eyebrow="Your arc starts in" num="–" unit="days" clock="00:00:00" range={range} />;
  if (s.phase === 'after') return <Hero eyebrow="Season one" num={String(season.arcDays)} unit="days done" clock="the next arc opens soon" range={range} />;
  if (s.phase === 'live') return <Hero eyebrow="Season one · live" num={String(s.day)} unit={`of ${season.arcDays} · proof due`} clock={s.clock} range={range} />;
  return <Hero eyebrow="Your arc starts in" num={String(s.days)} unit={s.days === 1 ? 'day' : 'days'} clock={s.clock} range={range} />;
}

function Hero({ eyebrow, num, unit, clock, range }: { eyebrow: string; num: string; unit: string; clock: string; range: string }) {
  return (
    <div className="hero-count">
      <div className="eyebrow ice">{eyebrow}</div>
      <div className="bignum" suppressHydrationWarning>{num}</div>
      <div className="bignum-l">{unit}</div>
      <div className="clock" suppressHydrationWarning>{clock}</div>
      <div className="daterange">{range}</div>
    </div>
  );
}
