import { isLocked, type Season, SEASON_ONE } from './season';

/**
 * Squad terms are set once by the founder and inherited by everyone who
 * joins, so the pot is fair and the ledger is readable. Size is the founder's
 * call: two is a pact, five to eight is a squad.
 */

export const SQUAD_LIMITS = {
  sizeMin: 2,
  sizeMax: 8,
  /** Below this many active members (or below the size, if smaller) the squad dissolves. */
  minActive: 3,
} as const;

export const STAKE_TIERS_CENTS = [500, 1000, 2500] as const;

export type PotRule = 'pot' | 'charity' | 'anti_charity';

/** Season one runs the virtual squad pot only. Money never moves inside the app. */
export const POT_RULES_LIVE: readonly PotRule[] = ['pot'];

export type Currency = 'EUR' | 'USD';

export interface SquadTerms {
  size: number;
  stakeCents: number;
  potRule: PotRule;
  currency: Currency;
}

export type SquadErrorCode = 'size' | 'stake' | 'pot_rule' | 'currency';

export class SquadError extends Error {
  constructor(
    public readonly code: SquadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SquadError';
  }
}

export function validateTerms(t: SquadTerms): SquadTerms {
  if (!Number.isInteger(t.size) || t.size < SQUAD_LIMITS.sizeMin || t.size > SQUAD_LIMITS.sizeMax) {
    throw new SquadError('size', `Squad size must be ${SQUAD_LIMITS.sizeMin} to ${SQUAD_LIMITS.sizeMax}`);
  }
  if (!(STAKE_TIERS_CENTS as readonly number[]).includes(t.stakeCents)) {
    throw new SquadError('stake', `Stake must be one of ${STAKE_TIERS_CENTS.join(', ')} cents`);
  }
  if (!POT_RULES_LIVE.includes(t.potRule)) {
    throw new SquadError('pot_rule', `Pot rule ${t.potRule} is not live this season`);
  }
  if (t.currency !== 'EUR' && t.currency !== 'USD') throw new SquadError('currency', 'Unsupported currency');
  return t;
}

/** No I, O, 0 or 1: codes are read aloud and typed from stories. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_PREFIX = 'ARC-';
const CODE_BODY = 4;

export function generateCode(random: () => number = Math.random): string {
  let body = '';
  for (let i = 0; i < CODE_BODY; i++) {
    body += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + body;
}

/** Accepts `arc-7k2q`, `7K2Q`, `ARC 7K2Q`; returns the canonical code or null. */
export function normalizeCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const candidates = raw.startsWith('ARC') ? [raw.slice(3), raw] : [raw];
  for (const s of candidates) {
    if (s.length === CODE_BODY && [...s].every((ch) => CODE_ALPHABET.includes(ch))) {
      return CODE_PREFIX + s;
    }
  }
  return null;
}

export function spotsLeft(size: number, memberCount: number): number {
  return Math.max(0, size - memberCount);
}

export type JoinRefusal = 'full' | 'locked' | 'dissolved';

export function canJoin(args: {
  size: number;
  memberCount: number;
  dateISO: string;
  dissolved?: boolean;
  season?: Season;
}): { ok: true } | { ok: false; reason: JoinRefusal } {
  if (args.dissolved) return { ok: false, reason: 'dissolved' };
  if (isLocked(args.dateISO, args.season ?? SEASON_ONE)) return { ok: false, reason: 'locked' };
  if (spotsLeft(args.size, args.memberCount) === 0) return { ok: false, reason: 'full' };
  return { ok: true };
}

/** Under three active members, or under the size for a pact of two, the survivors get re-drafted. */
export function shouldDissolve(size: number, activeMembers: number): boolean {
  return activeMembers < Math.min(SQUAD_LIMITS.minActive, size);
}

export function formatStake(stakeCents: number, currency: Currency): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  const whole = stakeCents / 100;
  return `${symbol}${Number.isInteger(whole) ? whole : whole.toFixed(2)}`;
}
