import { SEASON_ONE } from '@winarc/domain';
import { Countdown } from '@/components/countdown';
import { JoinForm } from '@/components/join-form';
import { dayMonth } from '@/lib/format';

/** The prototype's first screen. The date is the product: one number, one button. */
export default function Home() {
  return (
    <main className="view">
      <div className="brand">
        <span className="wordmark">WINARC</span>
        <span className="eyebrow">Season one · {SEASON_ONE.id}</span>
      </div>
      <Countdown />
      <div className="tiles">
        <div className="tile">
          <div className="v">{SEASON_ONE.arcDays}</div>
          <div className="l">days, one cohort</div>
        </div>
        <div className="tile">
          <div className="v">2–8</div>
          <div className="l">people per squad</div>
        </div>
        <div className="tile">
          <div className="v gold">€</div>
          <div className="l">misses feed the pot</div>
        </div>
      </div>
      <JoinForm />
      <p className="p">Sign a contract you can screenshot. Join a squad of two to eight. Prove every session with the in-app dual camera. Settle the pot every Sunday.</p>
      <p className="fine" style={{ marginTop: 'auto' }}>
        Squads lock {dayMonth(SEASON_ONE.locksOn)}. No feed. No coach. Just proof.
      </p>
    </main>
  );
}
