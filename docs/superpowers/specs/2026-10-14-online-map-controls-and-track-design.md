# Online map controls and track repair

## Scope

- Keep a single compact map attribution in the bottom-right corner. The MapLibre attribution remains authoritative and contains OpenFreeMap, OpenMapTiles, and OpenStreetMap links; the separate custom OpenStreetMap link is removed.
- Restyle MapLibre zoom and compass controls with Pilot+ graphite surfaces, borders, radii, focus states, and `#0067ff` active color.
- Turn the desktop playback dock into a compact graphite capsule with a primary play button, segmented speed control, and a branded range input.
- Show the selected vehicle's distance for the selected day in the fleet card instead of fuel. The value is calculated from the same track view model that is rendered on the map, so the number and route cannot disagree.
- Repair track mounting so track layers are mounted after either the initial map load or a later style load, and re-mounted when the style changes.

## Data and states

- Selecting a vehicle requests its track for the current selected day.
- While that request is pending, the selected card shows `Считаем…`; a successful route shows a rounded kilometre value; no route shows `Нет маршрута`.
- Unselected cards show `Выберите день`, because their route data is not fetched in bulk.
- A route requires at least two valid points. Empty and error states remain honest and visible in the selected vehicle panel.

## Verification

- Unit tests cover attribution removal, selected-day distance, loading/empty states, and delayed style-load track mounting.
- Run scoped Vitest, TypeScript, ESLint, production build, then authenticated production smoke after deployment.
