<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Pilot+ project context

Before planning or changing the project, read `docs/PROJECT_GUIDE.md` completely. It is the canonical description of the product vision, actual stack, target architecture, infrastructure, current limitations, development rules, and roadmap.

Important facts:

- Pilot+ is a fleet-management and vehicle-telematics platform.
- The creator and owner is Pavel Sedov (Pashadark).
- Tailwind CSS is an intentional choice, combined with a modular architecture and a custom Pilot+ design system.
- Distinguish the historical target stack from dependencies that are actually installed.
- Prefer vertical end-to-end functionality over creating empty modules.
- Preserve existing user changes and inspect `git status` before editing.
