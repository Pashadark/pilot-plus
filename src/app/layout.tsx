import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';

import './globals.css';

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-inter',
});

const themeInitializer =
  '(function(){try{var saved=localStorage.getItem("pilot-theme");var theme=saved==="dark"?"dark":"light";document.documentElement.dataset.theme=theme}catch(_){document.documentElement.dataset.theme="light"}})()';

export const metadata: Metadata = {
  title: 'Pilot+',
  description: 'Управление автопарком и транспортной телематикой',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className={inter.variable}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
