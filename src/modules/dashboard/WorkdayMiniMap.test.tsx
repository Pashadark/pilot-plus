// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { collapseMiniMapAttribution } from './WorkdayMiniMap';

it('collapses attribution without removing source links or its native toggle', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<details open class="maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show"><summary>ⓘ</summary><a href="https://openfreemap.org/">OpenFreeMap</a></details>';
  collapseMiniMapAttribution(root);
  const details = root.querySelector('details')!;
  expect(details.open).toBe(false);
  expect(details.classList.contains('maplibregl-compact-show')).toBe(false);
  expect(root.querySelector('a')?.href).toBe('https://openfreemap.org/');
  expect(root.querySelector('summary')).not.toBeNull();
  root.querySelector('summary')!.click();
  expect(details.open).toBe(true);
  root.querySelector('summary')!.click();
  expect(details.open).toBe(false);
});
