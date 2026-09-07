import { Mark } from './mark';

/** The lockup that opens every screen: the Arc mark, the name, the season. */
export function Brand({ seasonId }: { seasonId: string }) {
  return (
    <div className="brand">
      <span className="lockup">
        <Mark height={17} />
        <span className="wordmark">WINARC</span>
      </span>
      <span className="eyebrow">Season one · {seasonId}</span>
    </div>
  );
}
