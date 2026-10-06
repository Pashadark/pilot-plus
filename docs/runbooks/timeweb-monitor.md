# Timeweb Cloud billing monitor

The read-only worker refreshes `/opt/pilot-plus/shared/timeweb-monitor.json` every hour. The SUPER_ADMIN `/system` page reads that sanitized file. When `hours_left` first reaches 168 or less, the worker creates one `SYSTEM_BILLING_ALERT` job for the company's currently bound Telegram work group.

## Required secrets and identifiers

Keep these values only in root-owned `/etc/pilot-plus.env` (`0600`):

```dotenv
TIMEWEB_CLOUD_TOKEN=<read-only Timeweb Cloud API token>
TIMEWEB_ALERT_COMPANY_ID=<Pilot company ID whose bound work group receives the alert>
TIMEWEB_MONITOR_SNAPSHOT_PATH=/opt/pilot-plus/shared/timeweb-monitor.json
```

Do not put the token in Git, shell history, screenshots, logs or the snapshot. Use a token that only needs read access to account finances and servers.

## Install

```bash
install -o root -g root -m 0644 deploy/pilot-plus-timeweb-monitor.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/pilot-plus-timeweb-monitor.timer /etc/systemd/system/
install -d -o pilot-plus -g pilot-plus -m 0700 /opt/pilot-plus/shared
systemctl daemon-reload
systemctl start pilot-plus-timeweb-monitor.service
systemctl enable --now pilot-plus-timeweb-monitor.timer
```

## Verify

```bash
systemctl --no-pager --full status pilot-plus-timeweb-monitor.service
systemctl is-active pilot-plus-timeweb-monitor.timer
systemctl list-timers pilot-plus-timeweb-monitor.timer --no-pager
journalctl -u pilot-plus-timeweb-monitor.service -n 50 --no-pager
sudo -u pilot-plus test -s /opt/pilot-plus/shared/timeweb-monitor.json
```

Successful logs contain only `TIMEWEB_MONITOR_UPDATED`. Failures contain a safe code such as `TIMEWEB_TOKEN_MISSING`, `TIMEWEB_API_401` or `TIMEWEB_API_UNAVAILABLE`.

The snapshot must not contain `TIMEWEB_CLOUD_TOKEN`, authorization headers, card digits or raw provider responses.

## Behaviour checks

- With more than 168 hours left, `/system` shows a healthy Timeweb card and no Telegram job is created.
- At 168 hours or less, exactly one pending `SYSTEM_BILLING_ALERT` job is created for the bound group and `alertActive` becomes true.
- Re-running below the threshold does not create another job.
- After a refill above 168 hours, `alertActive` becomes false and a later threshold crossing can notify again.

## Rollback

```bash
systemctl disable --now pilot-plus-timeweb-monitor.timer
rm /etc/systemd/system/pilot-plus-timeweb-monitor.service
rm /etc/systemd/system/pilot-plus-timeweb-monitor.timer
systemctl daemon-reload
```

Removing the timer stops collection and alerts. It does not change the Timeweb account, delete the local snapshot or affect the main application.
