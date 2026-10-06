#!/usr/bin/env bash
set -euo pipefail
umask 077

backup_dir=${BACKUP_DIR:-/opt/pilot-plus/backups}
staging_root=${STAGING_ROOT:-/var/lib/pilot-plus-yandex-backup}
rclone_config=${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}
remote=${RCLONE_REMOTE:-pilot-yandex-crypt:PilotPlus/Production}
docker_bin=${DOCKER_BIN:-/usr/bin/docker}
tar_bin=${TAR_BIN:-/usr/bin/tar}
rclone_bin=${RCLONE_BIN:-/usr/bin/rclone}
install_bin=${INSTALL_BIN:-/usr/bin/install}

mapfile -t dumps < <(
  find "$backup_dir" -maxdepth 1 -type f -name 'pilot-*.dump' -printf '%T@ %p\n' |
    sort -nr |
    cut -d' ' -f2-
)
((${#dumps[@]} > 0)) || {
  echo 'No database backup found' >&2
  exit 1
}

database=${dumps[0]}
stamp=$(basename "$database")
stamp=${stamp#pilot-}
stamp=${stamp%.dump}
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || {
  echo 'Unexpected backup timestamp' >&2
  exit 1
}

private="$backup_dir/private-$stamp.tar.gz"
[[ -s "$database" ]] || {
  echo "Database backup is empty: $database" >&2
  exit 1
}
[[ -s "$private" ]] || {
  echo "Matching private archive is missing or empty: $private" >&2
  exit 1
}

"$docker_bin" exec -i pilot-postgres pg_restore --list <"$database" >/dev/null
"$tar_bin" -tzf "$private" >/dev/null

day="${stamp:0:4}-${stamp:4:2}-${stamp:6:2}"
stage="$staging_root/$stamp"
[[ "$stage" == "$staging_root/"* ]] || {
  echo 'Unsafe staging path' >&2
  exit 1
}

cleanup() {
  [[ -n "${stage:-}" && "$stage" == "$staging_root/"* ]] && rm -rf -- "$stage"
}
trap cleanup EXIT

rm -rf -- "$stage"
"$install_bin" -d -m 0700 "$stage"
"$install_bin" -m 0600 "$database" "$stage/database.dump"
"$install_bin" -m 0600 "$private" "$stage/private.tar.gz"
(cd "$stage" && sha256sum database.dump private.tar.gz >SHA256SUMS)

common=(
  --config "$rclone_config"
  --contimeout 20s
  --timeout 10m
  --retries 3
  --low-level-retries 10
)

"$rclone_bin" copy "$stage" "$remote/daily/$day" "${common[@]}" --size-only
"$rclone_bin" check "$stage" "$remote/daily/$day" "${common[@]}" --size-only --one-way
"$rclone_bin" copy "$stage" "$remote/latest" "${common[@]}" --size-only
"$rclone_bin" check "$stage" "$remote/latest" "${common[@]}" --size-only --one-way

mapfile -t days < <(
  "$rclone_bin" lsf "$remote/daily" "${common[@]}" --dirs-only |
    sed 's#/$##' |
    grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' |
    sort -r || true
)
for ((i = 7; i < ${#days[@]}; i++)); do
  "$rclone_bin" purge "$remote/daily/${days[$i]}" "${common[@]}"
done

echo "Yandex backup uploaded: $day"
