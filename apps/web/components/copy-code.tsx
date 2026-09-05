'use client';
import { useState } from 'react';

export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="coderow">
      <div className="code">{code}</div>
      <button
        className="btn sm ghost"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            // Clipboard is optional; the code is on screen.
          }
        }}
      >
        {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
