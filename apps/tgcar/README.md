# TG CAR preview

From this folder: `npm run dev` (port 3105), `npm run build`, `npm test`.
Uses dependencies already installed in the parent repository.

Independent local public-site preview. Reads the verified SUPA PRO company fleet and rental/maintenance intervals through a fixed SSH read-only SQL adapter; no remote mutations. Refreshes every 30 seconds. Run with `npm run dev -- --hostname 127.0.0.1` so this development bridge is not exposed on the network. The process needs permission to use the existing owner's SSH key.

The bridge is deliberately disabled under NODE_ENV=production. Before deployment replace it with a dedicated least-privilege service or read-only database transport. Do not deploy this local SSH bridge with root credentials.

Only public vehicle fields and computed availability leave the server. Client records, rental IDs, contracts, GPS, VIN and internal documents are neither queried nor returned. Photographs are restricted to the active company fleet. Archived/demo vehicles are excluded. `isRentalReady=false`, overlapping active/confirmed rentals, overdue active rentals and blocking maintenance prevent availability. Unscheduled planned maintenance tasks do not reserve a period. Missing prices are never replaced by demo rates.

Forms still do not submit client data or accept payment. Availability is informational, not an atomic reservation. See design-qa.md and LAUNCH.md for remaining work.
