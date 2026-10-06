# Vehicle detail gallery layout

## Goal

Bring the vehicle detail hero back to the approved three-column composition from the supplied reference: a visually dominant photo gallery, a compact technical-state card, and a narrow actions card, followed by the vehicle tabs.

## Layout

- Keep the existing header, real vehicle data, actions, and tabs.
- On wide screens, allocate the largest share of the hero grid to the gallery.
- Make the primary image taller and keep three thumbnails directly beneath it.
- Keep the technical and actions cards aligned with the gallery and preserve the existing stacked layout on smaller screens.

## Scope

This is a presentation-only adjustment in `VehicleDetailPage.tsx`; no database, routing, or data-model changes are required.

