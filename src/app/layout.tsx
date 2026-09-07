import type { Metadata } from 'next';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';

import './globals.css';

const themeInitializer =
  '(function(){try{var saved=localStorage.getItem("pilot-theme");var theme=saved==="dark"?"dark":"light";document.documentElement.dataset.theme=theme}catch(_){document.documentElement.dataset.theme="light"}})()';

export const metadata: Metadata = {
  title: 'СУПА ПРО',
  description: 'Система управления автопарком автомобилей',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
