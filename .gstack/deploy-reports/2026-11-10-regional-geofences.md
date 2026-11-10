# Supa Pro regional geofences production deployment

- Verdict: PASS
- Release: `20261110-regional-geofences-b356855`
- Source commits: `93de89f`, `5208980`, `b356855`
- Backup: `/opt/pilot-plus/backups/pre-regional-geofences-20261110-93de89f.dump`
- Backup SHA-256: `bc634c306247b4aa72d46e319b6f7be1ea6b11f870aa1f2316257d1bbef931fa`
- Migration: `20261110120000_add_rental_regional_geofences`
- Imported regions: 83; invalid boundaries: 0
- Backfilled active rentals: 17; invalid/null region unions: 0
- Active slot: blue
- Public canary: `/login` HTTP 200, deployment ID `20261110-b356855`
- Services: `supapro-web@blue` active; `pilot-plus-glonasssoft-worker` active
- Initial live evaluation: 9 of 17 geofences evaluated; 0 regional-geofence events created
- Deferred: 4 active rentals had no explicit territory in the available contract data and were intentionally left without regional enforcement.
