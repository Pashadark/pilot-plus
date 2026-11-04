import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, 'utf8');
describe('mobile dock layout integration', () => {
  it('uses contrasting white text on a solid primary active dock item', () => {
    const css = source('src/app/globals.css');
    const active = css.match(/\.mobile-dock__item\[data-current='true'\]\s*\{([^}]+)\}/)?.[1];
    expect(active).toContain('background: var(--color-primary)');
    expect(active).toContain('color: var(--mobile-navigation-active-text, #fff)');
    expect(css).toContain(":root[data-theme='dark']:not([data-interface='graphite'])");
    expect(css).toContain('--mobile-navigation-active-text: #101014');
  });
  it('subtracts the additional mobile Obsidian shell gutter from map height', () => {
    expect(source('src/app/globals.css')).toContain('--mobile-shell-extra: calc(var(--shell-gutter) * 2)');
    expect(source('src/modules/online-map/components/OnlineMapWorkspace.tsx')).toContain('-var(--mobile-shell-extra,0px)');
  });
  it('reserves dock space for page content and map workspace', () => {
    expect(source('src/app/globals.css')).toContain('padding-bottom: var(--mobile-dock-space)');
    expect(source('src/modules/online-map/components/OnlineMapWorkspace.tsx')).toContain(
      '100dvh-var(--header-height)-var(--mobile-dock-space,0px)',
    );
  });
  it('raises cookies and scroll-to-top only inside the protected shell', () => {
    const css = source('src/app/globals.css');
    expect(css).toContain("body:has([data-testid='app-shell']) .cookie-bar");
    expect(css).toContain("[data-testid='app-shell'] .shell-scroll-to-top");
    expect(css).toContain('bottom: calc(var(--mobile-dock-space) + 0.75rem)');
  });
  it('limits the dock to mobile and supports reduced motion', () => {
    const css = source('src/app/globals.css');
    expect(css).toContain('.mobile-dock {');
    expect(css).toContain('.mobile-navigation-sheet {');
    expect(css).toContain('animation: mobile-sheet-in');
    expect(css).toContain('.mobile-navigation-sheet {\n    animation: none;');
  });
});
