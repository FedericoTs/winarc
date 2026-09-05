'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeCode } from '@winarc/domain';

/** The join door from the prototype: a code in, the squad page out. */
export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const go = () => {
    const c = normalizeCode(code);
    if (!c) return setBad(true);
    router.push(`/join/${c}`);
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="customrow">
        <input
          className="input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setBad(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="Have a code? e.g. WIN-7K2Q"
          maxLength={12}
          autoCapitalize="characters"
          aria-label="Join code"
          aria-invalid={bad}
        />
        <button className="btn sm" type="button" onClick={go}>
          Join
        </button>
      </div>
      {bad ? <p className="fine" style={{ color: 'var(--p-rose)' }}>Codes look like WIN-7K2Q.</p> : null}
    </div>
  );
}
