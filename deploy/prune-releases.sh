#!/usr/bin/env bash
set -euo pipefail

release_root=/opt/pilot-plus/releases
keep_count=${PILOT_PLUS_RELEASES_TO_KEEP:-5}
current=$(readlink -f /opt/pilot-plus/current)

[[ "$keep_count" =~ ^[1-9][0-9]*$ ]] || { echo 'PILOT_PLUS_RELEASES_TO_KEEP must be positive' >&2; exit 1; }
[[ -d "$release_root" ]] || exit 0

mapfile -t releases < <(
  find "$release_root" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
    sort -n |
    cut -d' ' -f2-
)

remaining=${#releases[@]}
for target in "${releases[@]}"; do
  case "$target" in
    "$release_root"/*) ;;
    *) echo "Unsafe release path: $target" >&2; exit 1 ;;
  esac
  (( remaining <= keep_count )) && break
  [[ "$target" == "$current" ]] && continue
  rm -rf -- "$target"
  remaining=$((remaining - 1))
done
