import { expect, it } from 'vitest';
import { vehicleName } from './vehicle-name';

it('joins make and model with a space, not a separator', () => {
  expect(vehicleName('Skoda', 'Octavia')).toBe('Skoda Octavia');
});
it('does not repeat a make already present in the model', () => {
  expect(vehicleName('Volkswagen', 'Volkswagen Polo')).toBe('Volkswagen Polo');
  expect(vehicleName('Skoda', 'Skoda · Octavia')).toBe('Skoda Octavia');
});
it('handles missing fields without inventing a name', () => {
  expect(vehicleName(null, 'Octavia')).toBe('Octavia');
  expect(vehicleName(' Skoda ', null)).toBe('Skoda');
  expect(vehicleName(null, null)).toBe('');
});
