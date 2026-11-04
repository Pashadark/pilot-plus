// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { appearanceBootstrap } from './appearance-bootstrap';
beforeEach(() => localStorage.clear());
it.each(['classic', 'material', 'obsidian', 'graphite'])(
  'migrates %s to graphite preserving light',
  (mode) => {
    localStorage.setItem('pilot-interface', mode);
    localStorage.setItem('pilot-theme', 'light');
    localStorage.setItem('pilot-graphite-rollout', '1');
    window.eval(appearanceBootstrap);
    expect(document.documentElement.dataset.interface).toBe('graphite');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('pilot-interface')).toBe('graphite');
  },
);
