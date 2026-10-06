# System monitor — 2026-09-27

Visual target: selected option 3, exec-ed046e81-9538-401f-bc74-6ef5ffea3aac.png.

Implemented in the existing shell: 3-column desktop card grid, responsive layout, status filters, 30-second polling, manual refresh, stale-result error state, resource progress bars, SUPER_ADMIN page/API/navigation guards.

Verification: 33 targeted tests passed; scoped TypeScript and ESLint passed. Server production build tracked separately.

Authenticated production page was opened and captured. Real resource metrics rendered and timestamps advanced by 30 seconds. Filter activation could not be confirmed through the browser automation; full desktop/mobile comparison remains pending. CPU percentage is duplicated in its row (minor copy polish). Do not claim full visual QA passed.

Known limits: bot server monitoring unavailable pending trusted connection; Telegram process heartbeat not yet instrumented, empty queue is not considered proof of life. History is explicitly scoped to the open browser session, not persistent 24/7 monitoring. Existing shell retained rather than the mock's invented navigation.

final result: blocked
# Live remote metrics — 2026-09-27

Deployed `/opt/pilot-plus/releases/20260927-system-monitor-live` with previous release retained. 37 scoped tests passed; TypeScript, ESLint and production build passed. Authenticated production UI shows 13 cards, live bot-host disk/RAM/CPU/SSH latency/uptime and separate healthy bot/Redis containers. Root-owned collection timer active; changing collection timestamps verified. Unauthenticated endpoint returns 401. Dedicated SSH key was tested with an alternate command and returned only the forced metrics payload. API role tests remain passing. Polling interval is 15 seconds; remote data expires after 60 seconds. Durable history and the legacy sidebar 8/10 summary remain unchanged.

