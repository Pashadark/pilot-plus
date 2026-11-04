#!/usr/bin/env bash
set -euo pipefail

release_arg=${1:-}
release_root=/opt/pilot-plus/releases
slot_root=/opt/pilot-plus/slots
state_file=/opt/pilot-plus/shared/active-web-slot
upstream_file=/etc/nginx/snippets/supapro-active-upstream.conf
asset_file=/etc/nginx/snippets/supapro-active-assets.conf
build_env=/etc/supapro-build.env
DRAIN_SECONDS=${DRAIN_SECONDS:-130}

usage() {
  echo "Usage: $0 /opt/pilot-plus/releases/<release>" >&2
  exit 64
}

[[ -n "$release_arg" ]] || usage
[[ ! -L "$release_arg" ]] || { echo "Release path must be a real directory, not a symlink" >&2; exit 64; }
release=$(readlink -f "$release_arg")
[[ -d "$release" && -f "$release/package.json" ]] || usage
case "$release" in
  "$release_root"/*) ;;
  *) echo "Release must be inside $release_root" >&2; exit 64 ;;
esac
[[ -r "$build_env" ]] || { echo "Missing $build_env" >&2; exit 78; }

exec 9>/run/supapro-deploy.lock
flock -n 9 || { echo "Another Supa Pro deployment is running" >&2; exit 75; }

active=legacy
if [[ -r "$state_file" ]]; then
  active=$(<"$state_file")
fi
case "$active" in
  blue) target=green ;;
  green) target=blue ;;
  legacy) target=green ;;
  *) echo "Unknown active slot: $active" >&2; exit 65 ;;
esac

case "$target" in
  blue) target_port=3001 ;;
  green) target_port=3002 ;;
esac

previous_release=$(readlink -f /opt/pilot-plus/current || true)
[[ "$release" != "$previous_release" ]] || {
  echo "Release must differ from current; rebuilding an active release breaks immutable assets" >&2
  exit 64
}
previous_upstream=$(mktemp)
candidate_upstream=$(mktemp)
previous_asset=$(mktemp)
candidate_asset=$(mktemp)
health_body=$(mktemp)
runtime_env_candidate=$(mktemp)
switched=0

cleanup() {
  rm -f "$previous_upstream" "$candidate_upstream" "$previous_asset" "$candidate_asset" "$health_body" "$runtime_env_candidate"
}

rollback() {
  local exit_code=$?
  trap - ERR
  if [[ "$switched" == 1 && -s "$previous_upstream" ]]; then
    install -o root -g root -m 0644 "$previous_upstream" "$upstream_file"
    if [[ -s "$previous_asset" ]]; then
      install -o root -g root -m 0644 "$previous_asset" "$asset_file"
    fi
    nginx -t >/dev/null && systemctl reload nginx
  fi
  if [[ -n "$previous_release" ]]; then
    ln -sfn "$previous_release" /opt/pilot-plus/current.rollback
    mv -Tf /opt/pilot-plus/current.rollback /opt/pilot-plus/current
    systemctl restart pilot-plus-glonasssoft-worker.service >/dev/null 2>&1 || true
  fi
  systemctl stop "supapro-web@$target.service" >/dev/null 2>&1 || true
  cleanup
  exit "$exit_code"
}

trap rollback ERR
trap cleanup EXIT

cp -f "$upstream_file" "$previous_upstream" 2>/dev/null || true
cp -f "$asset_file" "$previous_asset" 2>/dev/null || true

set -a
# This file contains the stable build-only Server Actions encryption key.
# shellcheck disable=SC1090
. "$build_env"
set +a
: "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:?NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is required}"
export NEXT_DEPLOYMENT_ID=${SUPAPRO_DEPLOYMENT_ID:-$(basename "$release")}

cd "$release"
if [[ "${SUPAPRO_SKIP_BUILD:-0}" != 1 ]]; then
  npx prisma generate --schema src/database/prisma/schema.prisma
  npm run build
fi
test -s .next/BUILD_ID

install -d -o pilot-plus -g pilot-plus -m 0755 "$slot_root"
install -d -o pilot-plus -g pilot-plus -m 0755 "$release/.next/cache"
ln -sfn "$release" "$slot_root/$target.next"
mv -Tf "$slot_root/$target.next" "$slot_root/$target"
chown -h pilot-plus:pilot-plus "$slot_root/$target"

runtime_env="/etc/supapro-web-$target.env"
[[ -r "$runtime_env" ]] || { echo "Missing $runtime_env" >&2; exit 78; }
grep -v '^NEXT_DEPLOYMENT_ID=' "$runtime_env" >"$runtime_env_candidate" || true
printf 'NEXT_DEPLOYMENT_ID=%s\n' "$NEXT_DEPLOYMENT_ID" >>"$runtime_env_candidate"
install -o root -g root -m 0600 "$runtime_env_candidate" "$runtime_env.next"
mv -Tf "$runtime_env.next" "$runtime_env"

systemctl enable "supapro-web@$target.service"
systemctl restart "supapro-web@$target.service"

ready=0
for _ in $(seq 1 60); do
  if curl --fail --silent --show-error \
    --max-time 2 \
    -H 'Host: supapro.ru' \
    "http://127.0.0.1:$target_port/login" >"$health_body"; then
    if grep -q "data-dpl-id=\"$NEXT_DEPLOYMENT_ID\"" "$health_body"; then
      ready=1
      break
    fi
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo "New Supa Pro slot did not become ready" >&2; false; }

cat >"$candidate_upstream" <<EOF
upstream supapro_backend {
    server 127.0.0.1:$target_port max_fails=2 fail_timeout=3s;
    keepalive 32;
}
EOF
printf 'map $host $supapro_asset_version { default "%s"; }\n' "$NEXT_DEPLOYMENT_ID" >"$candidate_asset"
install -o root -g root -m 0644 "$candidate_upstream" "$upstream_file.next"
mv -Tf "$upstream_file.next" "$upstream_file"
install -o root -g root -m 0644 "$candidate_asset" "$asset_file.next"
mv -Tf "$asset_file.next" "$asset_file"
nginx -t
systemctl reload nginx
switched=1

ln -sfn "$release" /opt/pilot-plus/current.next
mv -Tf /opt/pilot-plus/current.next /opt/pilot-plus/current
systemctl restart pilot-plus-glonasssoft-worker.service
systemctl is-active --quiet pilot-plus-glonasssoft-worker.service
printf '%s\n' "$target" >"$state_file.next"
chown pilot-plus:pilot-plus "$state_file.next"
mv -Tf "$state_file.next" "$state_file"

curl --fail --silent --show-error --max-time 5 https://supapro.ru/login >/dev/null
sleep "$DRAIN_SECONDS"

case "$active" in
  blue|green)
    systemctl stop "supapro-web@$active.service" || true
    systemctl disable "supapro-web@$active.service" || true
    ;;
  legacy)
    systemctl stop pilot-plus.service || true
    systemctl disable pilot-plus.service || true
    ;;
esac

trap - ERR
cleanup
trap - EXIT
echo "Supa Pro is serving release $(basename "$release") from $target"
