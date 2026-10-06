import type { Metadata } from 'next';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';

import './globals.css';
import './material.css';

const themeInitializer =
  '(function(){try{var savedTheme=localStorage.getItem("pilot-theme");var savedInterface=localStorage.getItem("pilot-interface");document.documentElement.dataset.theme=savedTheme==="dark"?"dark":"light";document.documentElement.dataset.interface=savedInterface==="classic"||savedInterface==="material"?savedInterface:"obsidian"}catch(_){document.documentElement.dataset.theme="light";document.documentElement.dataset.interface="obsidian"}})()';

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
