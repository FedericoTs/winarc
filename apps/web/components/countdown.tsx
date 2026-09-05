'use client';
import { useEffect, useState } from 'react';
import { SEASON_ONE, dayOfSeason, localISODate } from '@winarc/domain';

type State = { phase: 'before'; days: number; clock: string } | { phase: 'live'; day: number; clock: string } | { phase: 'after' };

const pad = (n: number) => String(n).padStart(2, '0');
const hms = (ms: number) => `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}`;

function compute(now: Date): State {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localISODate(now, tz);
  const day = dayOfSeason(today, SEASON_ONE);
  if (day > SEASON_ONE.arcDays) return { phase: 'after' };
  if (day >= 1) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { phase: 'live', day, clock: hms(Math.max(0, end.getTime() - now.getTime())) };
  }
  const [y, m, d] = SEASON_ONE.startsOn.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  const left = Math.max(0, start.getTime() - now.getTime());
  const days = Math.floor(left / 86_400_000);
  return { phase: 'before', days, clock: hms(left - days * 86_400_000) };
}

/** The prototype's first screen: one number, one clock. Computed on the client so the page can be static. */
export function Countdown() {
  const [s, setS] = useState<State | null>(null);
  useEffect(() => {
    setS(compute(new Date()));
    const id = setInterval(() => setS(compute(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  if (!s) return <Hero eyebrow="Your arc starts in" num="–" unit="days" clock="00:00:00" />;
  if (s.phase === 'after') return <Hero eyebrow="Season one" num="90" unit="days done" clock="next arc opens 01 Jan" />;
  if (s.phase === 'live') return <Hero eyebrow="Season one · live" num={String(s.day)} unit={`of ${SEASON_ONE.arcDays} · proof due`} clock={s.clock} />;
  return <Hero eyebrow="Your arc starts in" num={String(s.days)} unit={s.days === 1 ? 'day' : 'days'} clock={s.clock} />;
}

function Hero({ eyebrow, num, unit, clock }: { eyebrow: string; num: string; unit: string; clock: string }) {
  return (
    <div className="hero-count">
      <div className="eyebrow ice">{eyebrow}</div>
      <div className="bignum" suppressHydrationWarning>{num}</div>
      <div className="bignum-l">{unit}</div>
      <div className="clock" suppressHydrationWarning>{clock}</div>
      <div className="daterange">01 OCT → 31 DEC 2026</div>
    </div>
  );
}
