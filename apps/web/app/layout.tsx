import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// Absolute URLs for the share image: the site's own domain once it exists, Vercel's production URL until then.
const SITE = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

const DESCRIPTION = 'Squad season. Sign a contract, join a squad, prove every session. Season one starts 1 Oct.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'WinArc',
  description: DESCRIPTION,
  openGraph: { title: 'WinArc', description: DESCRIPTION, siteName: 'WinArc', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#0B0D12', colorScheme: 'dark' };

// The same faces the prototype and the app use: Big Shoulders Display 900 for
// numerals and slates, Instrument Sans for UI, IBM Plex Mono for codes and clocks.
const FONTS = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <div className="stage">{children}</div>
      </body>
    </html>
  );
}
