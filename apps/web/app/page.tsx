import { SEASON_ONE, dayOfSeason } from '@winarc/domain';

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const day = dayOfSeason(today, SEASON_ONE);
  const live = day >= 1 && day <= SEASON_ONE.arcDays;
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px' }}>
      <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12, color: '#8A97A8' }}>Season one · S01</p>
      <h1 style={{ fontSize: 64, lineHeight: 0.9, margin: '12px 0 24px', textTransform: 'uppercase' }}>
        {live ? `Day ${day} of ${SEASON_ONE.arcDays}` : 'Your arc starts 1 Oct'}
      </h1>
      <p style={{ fontSize: 18, lineHeight: 1.5, color: '#C7D1DD' }}>
        Sign a contract you can screenshot. Join a squad of two to eight. Prove every session with the in-app dual camera. Settle the pot every Sunday. No feed, no coach, just proof.
      </p>
      <p style={{ marginTop: 32, color: '#8A97A8' }}>Have a code? Open <code>winarc.team/join/WIN-XXXX</code> on your phone.</p>
    </main>
  );
}
