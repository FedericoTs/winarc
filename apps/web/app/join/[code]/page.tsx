import type { Metadata } from 'next';
import { SEASON_ONE, endsOn, formatStake, normalizeCode } from '@winarc/domain';
import { CopyCode } from '@/components/copy-code';
import { dayMonth, dayMonthUpper } from '@/lib/format';
import { squadPreview } from '@/lib/squad-preview';

export const revalidate = 60;

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const code = normalizeCode((await params).code);
  return { title: code ? `Join ${code} · WinArc` : 'WinArc' };
}

/**
 * What a recruit sees when they tap a share card without the app: the poster
 * from the other side. One number, the stake. Identity, the squad. The code
 * in the dashed box. Every line here has a twin on the card that sent them.
 */
export default async function Join({ params }: Params) {
  const raw = (await params).code;
  const code = normalizeCode(raw);

  if (!code) {
    return (
      <main className="view">
        <Brand />
        <div className="eyebrow ice">Join a squad</div>
        <h1 className="disp h2" style={{ margin: 0 }}>That code doesn&apos;t look right.</h1>
        <p className="p">Codes look like WIN-7K2Q. Ask your founder to send it again.</p>
        <a className="btn ghost" href="/" style={{ marginTop: 'auto' }}>
          Back
        </a>
      </main>
    );
  }

  const squad = await squadPreview(code);
  const deepLink = `winarc://join/${code}`;
  const locksOn = dayMonth(squad?.locks_on ?? SEASON_ONE.locksOn);
  const stake = squad ? formatStake(squad.stake_cents, squad.currency) : null;
  const spots = squad ? `${squad.spots_left} ${squad.spots_left === 1 ? 'spot' : 'spots'}` : 'spots open';
  const name = squad?.name ?? null;

  return (
    <main className="view">
      <Brand />
      <div className="eyebrow ice">{name ? `You're invited · ${name}` : "You're invited"}</div>
      <h1 className="disp h2" style={{ margin: 0 }}>
        You don&apos;t do this alone.
      </h1>

      <div className="scard" aria-label="Squad invite">
        <div className="pad">
          <div className="ey">Season one · {SEASON_ONE.id} · locks {locksOn}</div>
          <div className="big" style={{ fontSize: 48, marginTop: 10, overflowWrap: 'anywhere' }}>
            {name ? name : <>Join<br />the squad</>}
          </div>
          <div className="cp-lines">
            {squad ? (
              <div>
                <span>{squad.size} people · {squad.member_count} in</span>
                <b>{spots}</b>
              </div>
            ) : (
              <div>
                <span>2 to 8 people</span>
                <b>one code</b>
              </div>
            )}
            <div className="gold">
              <span>{stake ?? 'stake'} per miss</span>
              <b>{squad?.pot_rule === 'pot' || !squad ? 'squad pot' : squad.pot_rule}</b>
            </div>
            <div>
              <span>
                {dayMonthUpper(SEASON_ONE.startsOn)} → {dayMonthUpper(endsOn(SEASON_ONE))}
              </span>
              <b>{SEASON_ONE.arcDays} days</b>
            </div>
          </div>
          <div className="cp-join">
            <span>Join · {code}</span>
            <span>{spots}</span>
          </div>
          {/* Where the poster carries the contract lines, the invite carries the deal. */}
          <div className="ey" style={{ marginTop: 18 }}>The deal</div>
          <div className="cp-lines" style={{ marginTop: 6 }}>
            <div>
              <span>Dual-cam proof</span>
              <b>in-app only</b>
            </div>
            <div>
              <span>Sunday ledger</span>
              <b>21:00 local</b>
            </div>
            <div>
              <span>Rescues</span>
              <b>sick day · vouch</b>
            </div>
            <div>
              <span>A miss</span>
              <b>never resets your arc</b>
            </div>
          </div>
          <div className="wm">
            <b>WINARC</b> · {SEASON_ONE.id} · <span className="jc">join {code}</span>
            <br />
            {name ?? 'Squad forming'} · starts {dayMonth(SEASON_ONE.startsOn)} · you inherit the terms
          </div>
        </div>
      </div>

      {squad?.locked ? <div className="matched rose">This squad locked on {locksOn}. Ask the founder about the next arc, same code.</div> : null}
      {squad && !squad.locked && squad.spots_left === 0 ? <div className="matched rose">This squad is full. Two is a pact: start your own with a friend.</div> : null}

      <CopyCode code={code} />
      <a className="btn" href={deepLink}>
        Open in WinArc
      </a>
      <span className="btn ghost" aria-disabled="true">
        App Store · opens at launch
      </span>
      <p className="fine" style={{ marginTop: 'auto' }}>
        You inherit the squad&apos;s stake and pot rule. No terms to set. Squads lock {locksOn}.
      </p>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="wordmark">WINARC</span>
      <span className="eyebrow">Season one · {SEASON_ONE.id}</span>
    </div>
  );
}
