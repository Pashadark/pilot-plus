import type { Metadata } from 'next';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';
import { appearanceBootstrap } from '@/shared/providers/appearance-bootstrap';
import { CookieConsent } from '@/shared/components/CookieConsent';

import './globals.css';
import './graphite.css';
import './workday.css';

export const metadata: Metadata = {
  title: 'СУПА ПРО',
  description: 'Система управления автопарком автомобилей',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-interface="graphite" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
