#!/usr/bin/env bash
set -euo pipefail

release_root=/opt/pilot-plus/releases
current_link=/opt/pilot-plus/current
keep_count=${PILOT_PLUS_KEEP_RELEASES:-5}
resolved_root=$(readlink -f "$release_root")
current=$(readlink -f "$current_link")

[[ "$keep_count" =~ ^[1-9][0-9]*$ ]] || { echo 'PILOT_PLUS_KEEP_RELEASES must be positive' >&2; exit 1; }
[[ -d "$release_root" ]] || exit 0

mapfile -t releases < <(
  find "$release_root" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
    sort -n |
    cut -d' ' -f2-
)

remaining=${#releases[@]}
for target in "${releases[@]}"; do
  resolved=$(readlink -f "$target")
  case "$resolved" in
    "$resolved_root"/*) ;;
    *) echo "Unsafe release path: $resolved" >&2; exit 1 ;;
  esac
  (( remaining <= keep_count )) && break
  [[ "$resolved" == "$current" ]] && continue
  rm -rf -- "$resolved"
  remaining=$((remaining - 1))
done
