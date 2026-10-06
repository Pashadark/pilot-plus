# Maintenance meter implementation plan

Goal: show remaining service mileage in vehicle cards and map, edit last/next mileage and date.
Architecture: reuse MaintenanceRecord (odometerKm baseline, targetOdometerKm target), tenant-scoped server actions and one shared client widget. No fabricated completed work or telemetry.

- [ ] Test calculation, missing/invalid readings, overdue mileage and smooth color.
- [ ] Implement read/save actions with management permissions, concurrency checks and audit.
- [ ] Integrate thin meters and editor in cards/map. Preserve unrelated changes.
- [ ] Run focused tests, TypeScript and lint. Deployment only after verification.
