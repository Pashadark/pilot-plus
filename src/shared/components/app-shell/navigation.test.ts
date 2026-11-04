import { expect, it } from 'vitest';
import * as routes from './navigation';
import type { SafeUser } from '@/modules/auth/types';

it('shares authorized navigation across desktop and mobile shells', () => {
  const exports = routes as typeof routes & {
    getVisibleNavigation?: (user: SafeUser) => readonly routes.NavigationItem[];
  };
  expect(typeof exports.getVisibleNavigation).toBe('function');
  const member: SafeUser = {
    id: 'u',
    name: 'Member',
    email: 'u@example.test',
    role: 'MEMBER',
    canAccessAdmin: false,
    capabilities: [],
  };
  expect(exports.getVisibleNavigation!(member).map(({ href }) => href)).toEqual([
    '/',
    '/map',
    '/vehicles',
    '/maintenance',
    '/wash',
    '/devices',
    '/events',
    '/ui-kit',
  ]);
  expect(
    exports.getVisibleNavigation!({
      ...member,
      canAccessAdmin: true,
      capabilities: ['CLIENTS', 'RENTALS', 'FINES'],
    }).map(({ href }) => href),
  ).toContain('/admin');
  expect(
    exports.getVisibleNavigation!({ ...member, role: 'SUPER_ADMIN' }).map(({ href }) => href),
  ).toContain('/system');
});
