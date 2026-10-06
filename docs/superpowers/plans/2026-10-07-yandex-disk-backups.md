# Yandex Disk Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload each verified nightly Pilot+ database and private-storage backup to encrypted Yandex Disk storage at 01:30 Moscow time, maintain `latest`, and retain seven dated cloud copies.

**Architecture:** A focused shell script selects the newest complete local backup pair, validates both archives, stages stable filenames plus a SHA-256 manifest, uploads through an `rclone crypt` remote, verifies remote sizes, and only then prunes dated cloud directories beyond seven. A hardened systemd oneshot and timer schedule the upload independently from the existing local backup timer.

**Tech Stack:** Bash, systemd, Docker PostgreSQL tooling, tar, SHA-256, rclone Yandex backend, rclone crypt.

## Global Constraints

- Run every day at 01:30 in `Europe/Moscow`.
- Upload only a complete database/private archive pair with the same timestamp.
- Keep `latest` plus the current day and six previous dated copies.
- Encrypt file names and contents before upload.
- Never expose OAuth tokens, account credentials, or crypt keys in logs or source control.
- A failed verification or upload must not delete server backups or the prior cloud copy.
- Cloud cleanup is confined to `PilotPlus/Production/daily` on the encrypted remote.

---

### Task 1: Versioned uploader and systemd units

**Files:**
- Create: `deploy/upload-yandex-backup.sh`
- Create: `deploy/tests/upload-yandex-backup.test.sh`
- Create: `deploy/pilot-plus-yandex-backup.service`
- Create: `deploy/pilot-plus-yandex-backup.timer`

**Interfaces:**
- Consumes: `/opt/pilot-plus/backups/pilot-<stamp>.dump`, `/opt/pilot-plus/backups/private-<stamp>.tar.gz`, `/root/.config/rclone/rclone.conf`.
- Produces: encrypted `pilot-yandex-crypt:PilotPlus/Production/{latest,daily/YYYY-MM-DD}` and a systemd oneshot exit status.

- [ ] **Step 1: Write a failing shell regression test**

Create `deploy/tests/upload-yandex-backup.test.sh` with two isolated cases. The first provides a database without the matching private archive and asserts a non-zero exit before `rclone` is invoked. The second provides a complete pair, fake verifier binaries, and a fake `rclone` that records calls; assert uploads to both `daily/2026-10-07` and `latest`, two checks, and purge of only the eighth dated directory.

```bash
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
chmod +x "$tmp/bin/"*

printf db >"$tmp/backups/pilot-20261007T003000Z.dump"
if BACKUP_DIR="$tmp/backups" STAGING_ROOT="$tmp/state" \
  DOCKER_BIN="$tmp/bin/docker" TAR_BIN="$tmp/bin/tar" \
  RCLONE_BIN="$tmp/bin/rclone" RCLONE_LOG="$tmp/rclone.log" \
  "$script"; then
  echo 'incomplete pair unexpectedly succeeded' >&2
  exit 1
fi
test ! -e "$tmp/rclone.log"

printf private >"$tmp/backups/private-20261007T003000Z.tar.gz"
RCLONE_LOG="$tmp/rclone.log" BACKUP_DIR="$tmp/backups" STAGING_ROOT="$tmp/state" \
  DOCKER_BIN="$tmp/bin/docker" TAR_BIN="$tmp/bin/tar" \
  RCLONE_BIN="$tmp/bin/rclone" RCLONE_CONFIG="$tmp/rclone.conf" \
  "$script"

grep -q 'copy .*daily/2026-10-07' "$tmp/rclone.log"
grep -q 'copy .*latest' "$tmp/rclone.log"
test "$(grep -c '^check ' "$tmp/rclone.log")" -eq 2
grep -q 'purge .*daily/2026-09-30' "$tmp/rclone.log"
test "$(grep -c '^purge ' "$tmp/rclone.log")" -eq 1
```

- [ ] **Step 2: Run the test and verify it fails because the uploader does not exist**

Run on a Linux shell:

```bash
bash deploy/tests/upload-yandex-backup.test.sh
```

Expected: non-zero with `deploy/upload-yandex-backup.sh: No such file or directory`.

- [ ] **Step 3: Implement the uploader**

Create `deploy/upload-yandex-backup.sh`:

```bash
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

mapfile -t dumps < <(find "$backup_dir" -maxdepth 1 -type f -name 'pilot-*.dump' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
((${#dumps[@]} > 0)) || { echo 'No database backup found' >&2; exit 1; }
database=${dumps[0]}
stamp=$(basename "$database")
stamp=${stamp#pilot-}
stamp=${stamp%.dump}
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || { echo 'Unexpected backup timestamp' >&2; exit 1; }
private="$backup_dir/private-$stamp.tar.gz"
test -s "$database"
test -s "$private"

"$docker_bin" exec -i pilot-postgres pg_restore --list <"$database" >/dev/null
"$tar_bin" -tzf "$private" >/dev/null

day="${stamp:0:4}-${stamp:4:2}-${stamp:6:2}"
stage="$staging_root/$stamp"
rm -rf -- "$stage"
install -d -m 0700 "$stage"
install -m 0600 "$database" "$stage/database.dump"
install -m 0600 "$private" "$stage/private.tar.gz"
(cd "$stage" && sha256sum database.dump private.tar.gz >SHA256SUMS)

common=(--config "$rclone_config" --contimeout 20s --timeout 10m --retries 3 --low-level-retries 10)
"$rclone_bin" copy "$stage" "$remote/daily/$day" "${common[@]}" --size-only
"$rclone_bin" check "$stage" "$remote/daily/$day" "${common[@]}" --size-only --one-way
"$rclone_bin" copy "$stage" "$remote/latest" "${common[@]}" --size-only
"$rclone_bin" check "$stage" "$remote/latest" "${common[@]}" --size-only --one-way

mapfile -t days < <("$rclone_bin" lsf "$remote/daily" "${common[@]}" --dirs-only | sed 's#/$##' | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' | sort -r || true)
for ((i=7; i<${#days[@]}; i++)); do
  "$rclone_bin" purge "$remote/daily/${days[$i]}" "${common[@]}"
done

rm -rf -- "$stage"
echo "Yandex backup uploaded: $day"
```

- [ ] **Step 4: Run the regression test and verify it passes**

Run:

```bash
bash deploy/tests/upload-yandex-backup.test.sh
```

Expected: exit code `0` and no output after the expected incomplete-pair error.

- [ ] **Step 5: Create hardened systemd units**

Create `deploy/pilot-plus-yandex-backup.service`:

```ini
[Unit]
Description=Upload verified Pilot+ backup to encrypted Yandex Disk
After=network-online.target docker.service pilot-plus-backup.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
User=root
Group=root
UMask=0077
ExecStart=/usr/local/sbin/pilot-plus-upload-yandex-backup
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=read-only
ProtectSystem=strict
ReadOnlyPaths=/opt/pilot-plus/backups /root/.config/rclone
ReadWritePaths=/var/lib/pilot-plus-yandex-backup
```

Create `deploy/pilot-plus-yandex-backup.timer`:

```ini
[Unit]
Description=Upload Pilot+ backup to Yandex Disk nightly

[Timer]
OnCalendar=*-*-* 01:30:00 Europe/Moscow
Persistent=true
Unit=pilot-plus-yandex-backup.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 6: Validate units and commit**

Run:

```bash
systemd-analyze verify deploy/pilot-plus-yandex-backup.service deploy/pilot-plus-yandex-backup.timer
git diff --check
git add deploy/upload-yandex-backup.sh deploy/tests/upload-yandex-backup.test.sh deploy/pilot-plus-yandex-backup.service deploy/pilot-plus-yandex-backup.timer
git commit -m "feat: add encrypted Yandex backup upload"
```

Expected: test and unit validation succeed; commit contains only the four deployment files.

### Task 2: Authorize and encrypt the Yandex remote

**Files:**
- Create on production: `/root/.config/rclone/rclone.conf` with mode `0600`
- Create locally: `C:\Users\pasahdark\Backups\PilotPlus\yandex-recovery\rclone.conf`

**Interfaces:**
- Consumes: one-time Yandex OAuth approval by the owner.
- Produces: `pilot-yandex:` and encrypted `pilot-yandex-crypt:` remotes.

- [ ] **Step 1: Install rclone from the official release channel and record its version**

Run on production after checking the published package/version:

```bash
apt-get update
apt-get install -y rclone
rclone version
```

Expected: an installed rclone version that supports both `yandex` and `crypt` backends.

- [ ] **Step 2: Complete Yandex OAuth authorization**

Run `rclone config` in an interactive production terminal, create remote `pilot-yandex`, select storage type `yandex`, leave custom client ID and secret blank, select headless authorization, and give the owner the generated authorization URL. Continue only after the owner approves access and rclone stores the token.

- [ ] **Step 3: Create the encrypted remote without exposing keys**

Generate two random secrets, obscure them, and create `pilot-yandex-crypt` pointing at `pilot-yandex:PilotPlus/Production` with standard filename and directory encryption. Do not echo raw secrets or the configuration.

```bash
password=$(openssl rand -base64 48)
password2=$(openssl rand -base64 48)
obscured_password=$(rclone obscure "$password")
obscured_password2=$(rclone obscure "$password2")
rclone config create pilot-yandex-crypt crypt \
  remote pilot-yandex:PilotPlus/Production \
  filename_encryption standard \
  directory_name_encryption true \
  password "$obscured_password" \
  password2 "$obscured_password2" \
  --no-obscure
unset password password2 obscured_password obscured_password2
chmod 0600 /root/.config/rclone/rclone.conf
```

- [ ] **Step 4: Test an isolated encrypted round trip**

Upload a random test file to `pilot-yandex-crypt:ConnectionTest`, list it through the crypt remote, download it, compare SHA-256, then purge only `ConnectionTest`.

- [ ] **Step 5: Save and protect the recovery configuration locally**

Copy `/root/.config/rclone/rclone.conf` to `C:\Users\pasahdark\Backups\PilotPlus\yandex-recovery\rclone.conf`, compare SHA-256, then restrict the Windows ACL to the owner account. Never add this file to Git.

### Task 3: Production installation and verified first upload

**Files:**
- Install: `/usr/local/sbin/pilot-plus-upload-yandex-backup`
- Install: `/etc/systemd/system/pilot-plus-yandex-backup.service`
- Install: `/etc/systemd/system/pilot-plus-yandex-backup.timer`

**Interfaces:**
- Consumes: Task 1 artifacts and Task 2 rclone remotes.
- Produces: active nightly upload timer and a verified first cloud backup.

- [ ] **Step 1: Install deployment artifacts with explicit ownership and modes**

```bash
install -o root -g root -m 0750 deploy/upload-yandex-backup.sh /usr/local/sbin/pilot-plus-upload-yandex-backup
install -o root -g root -m 0644 deploy/pilot-plus-yandex-backup.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/pilot-plus-yandex-backup.timer /etc/systemd/system/
install -d -o root -g root -m 0700 /var/lib/pilot-plus-yandex-backup
systemctl daemon-reload
systemd-analyze verify pilot-plus-yandex-backup.service pilot-plus-yandex-backup.timer
```

- [ ] **Step 2: Run the first upload manually**

```bash
systemctl start pilot-plus-yandex-backup.service
systemctl --no-pager --full status pilot-plus-yandex-backup.service
journalctl -u pilot-plus-yandex-backup.service -n 100 --no-pager
```

Expected: oneshot finishes successfully and logs only the uploaded date, not credentials.

- [ ] **Step 3: Verify cloud contents and restoration**

List `latest` and the dated directory through the crypt remote, download `latest` to a temporary directory, verify PostgreSQL and tar archives again, and compare its `SHA256SUMS`. Remove only the temporary restore directory afterward.

- [ ] **Step 4: Enable the timer and verify its schedule**

```bash
systemctl enable --now pilot-plus-yandex-backup.timer
systemctl is-active pilot-plus-yandex-backup.timer
systemctl list-timers pilot-plus-yandex-backup.timer --no-pager
```

Expected: timer is active and the next trigger is 01:30 `Europe/Moscow`.

- [ ] **Step 5: Verify unrelated production services remain healthy**

```bash
systemctl is-active pilot-plus pilot-plus-glonasssoft-worker pilot-plus-avito
curl -fsSI https://supapro.ru/login | head -n 1
df -h /
```

Expected: all three services are active, site returns `HTTP/1.1 200 OK`, and disk usage remains below 80%.

- [ ] **Step 6: Record deployment and rollback evidence**

Record rclone version, unit checks, first uploaded date, recovery-config checksum, next timer activation, and the rollback commands. Rollback disables only `pilot-plus-yandex-backup.timer`; it does not delete local or cloud backups.
