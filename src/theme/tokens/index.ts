export const themeTokens = {
  colors: {
    canvas: 'var(--color-canvas)',
    surface: 'var(--color-surface)',
    text: 'var(--color-text)',
    primary: 'var(--color-primary)',
  },
  radii: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
  motion: { fast: 'var(--motion-fast)', normal: 'var(--motion-normal)' },
  layout: {
    sidebarCollapsed: 'var(--sidebar-width-collapsed)',
    sidebarExpanded: 'var(--sidebar-width-expanded)',
    headerHeight: 'var(--header-height)',
  },
} as const;
