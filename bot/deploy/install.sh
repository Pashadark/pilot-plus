#!/usr/bin/env sh
set -eu

test "$(id -u)" -eq 0 || { echo "Run as root" >&2; exit 1; }
test -f /etc/pilot-plus-bot.env || { echo "Create /etc/pilot-plus-bot.env first" >&2; exit 1; }
chmod 600 /etc/pilot-plus-bot.env
install -m 0644 bot/deploy/pilot-plus-bot.service /etc/systemd/system/pilot-plus-bot.service
systemctl daemon-reload
systemctl enable --now pilot-plus-bot.service
