# Telegram fine report delivery repair

All 22 ERROR jobs were DAILY_UNPAID_FINES, two per day on September 17–27. Other templates had recent successful deliveries. Bot logs showed TelegramBadRequest. The report formatter emitted unbounded messages; a 50-item regression sample produced 16,381 UTF-16 units and failed the Telegram 4,096 limit test.

The bot now bounds this report to 3,900 UTF-16 units at complete paragraph boundaries and explicitly links the full list. Two no-network regression cases passed after reproducing the failure. The bot was rebuilt; Docker health was healthy. Only the two September 27 undelivered jobs were retried, both confirmed SENT at 14:27:02 UTC.

Twenty older daily summaries were marked SUPERSEDED_BY_CURRENT_REPORT, retaining ERROR status and null sentAt. An audit entry records the disposition. They were not resent, deleted, or falsely marked SENT. Operational health excludes these explicitly superseded records from actionable errors. Thirty system-health tests passed.

Rollback module backup: bot host /opt/pilot-plus-backups/notifications-before-limit.py. Web rollback release: /opt/pilot-plus/releases/20260927-system-monitor-live.
