param(
  [Parameter(Mandatory = $true)][string]$GeoJsonPath,
  [switch]$DryRun
)

# Export only amenity=fuel points from an OSM/Overpass/Geofabrik-derived GeoJSON.
# Keep © OpenStreetMap contributors attribution in the application and refresh this file periodically.
$argsList = @('fuel-stations:import', '--', "--file=$GeoJsonPath")
if ($DryRun) { $argsList += '--dry-run' }
npm run @argsList
