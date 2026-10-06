#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
script="$repo_root/deploy/upload-yandex-backup.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/bin" "$tmp/backups" "$tmp/state"

cat >"$tmp/bin/docker" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
EOF

cat >"$tmp/bin/tar" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat >"$tmp/bin/rclone" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$RCLONE_LOG"
if [[ "$1" == lsf ]]; then
  printf '%s/\n' 2026-09-30 2026-10-01 2026-10-02 2026-10-03 2026-10-04 2026-10-05 2026-10-06 2026-10-07
fi
EOF

cat >"$tmp/bin/install" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == -d ]]; then
  mkdir -p "${@: -1}"
else
  cp "${@: -2:1}" "${@: -1}"
fi
EOF

chmod +x "$tmp/bin/"*

printf db >"$tmp/backups/pilot-20261007T003000Z.dump"
if RCLONE_LOG="$tmp/rclone.log" BACKUP_DIR="$tmp/backups" STAGING_ROOT="$tmp/state" \
  DOCKER_BIN="$tmp/bin/docker" TAR_BIN="$tmp/bin/tar" INSTALL_BIN="$tmp/bin/install" \
  RCLONE_BIN="$tmp/bin/rclone" "$script"; then
  echo 'incomplete pair unexpectedly succeeded' >&2
  exit 1
fi
test ! -e "$tmp/rclone.log"

printf private >"$tmp/backups/private-20261007T003000Z.tar.gz"
RCLONE_LOG="$tmp/rclone.log" BACKUP_DIR="$tmp/backups" STAGING_ROOT="$tmp/state" \
  DOCKER_BIN="$tmp/bin/docker" TAR_BIN="$tmp/bin/tar" INSTALL_BIN="$tmp/bin/install" \
  RCLONE_BIN="$tmp/bin/rclone" RCLONE_CONFIG="$tmp/rclone.conf" \
  "$script"

grep -q 'copy .*daily/2026-10-07' "$tmp/rclone.log"
grep -q 'copy .*latest' "$tmp/rclone.log"
test "$(grep -c '^check ' "$tmp/rclone.log")" -eq 2
grep -q 'purge .*daily/2026-09-30' "$tmp/rclone.log"
test "$(grep -c '^purge ' "$tmp/rclone.log")" -eq 1
