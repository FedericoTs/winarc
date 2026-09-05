import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'WinArc',
  description: 'Squad season. Sign a contract, join a squad, prove every session. Season one starts 1 Oct.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0B0D12', color: '#EAF2FA', fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
