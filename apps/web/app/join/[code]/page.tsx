import { normalizeCode, SEASON_ONE } from '@arc/domain';

/**
 * The join page behind every share card. Deep-links into the app; falls back
 * to the store. Squad details come from the `squad_preview` RPC once the
 * public Supabase client is wired here.
 */
export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);

  if (!code) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ textTransform: 'uppercase' }}>That code doesn't look right</h1>
        <p style={{ color: '#8A97A8' }}>Codes look like ARC-7K2Q. Ask your founder to send it again.</p>
      </main>
    );
  }

  const deepLink = `arc://join/${code}`;
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px' }}>
      <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12, color: '#8A97A8' }}>Join a squad</p>
      <h1 style={{ fontSize: 56, lineHeight: 0.9, margin: '12px 0 24px', textTransform: 'uppercase' }}>{code}</h1>
      <p style={{ color: '#C7D1DD', lineHeight: 1.5 }}>
        You inherit the squad's stake and pot rule. Squads lock on {SEASON_ONE.locksOn}. Open the app to join.
      </p>
      <a
        href={deepLink}
        style={{ display: 'inline-block', marginTop: 24, padding: '16px 22px', background: '#9CD3FF', color: '#0B0D12', borderRadius: 14, fontWeight: 600, textDecoration: 'none' }}
      >
        Open in ARC
      </a>
      <p style={{ marginTop: 24, color: '#8A97A8', fontSize: 14 }}>No app yet? The store link goes here at launch.</p>
    </main>
  );
}
