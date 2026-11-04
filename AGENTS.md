<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Supa Pro project context

Before planning or changing the project, read `docs/PROJECT_GUIDE.md` completely. It is the canonical description of the product vision, actual stack, target architecture, infrastructure, current limitations, development rules, and roadmap.

Important facts:

- The product's only current public name is **Supa Pro**: a fleet-management and vehicle-telematics platform.
- The creator and owner is Pavel Sedov (Pashadark).
- Tailwind CSS is an intentional choice, combined with a modular architecture and the custom Supa Pro design system.
- Distinguish the historical target stack from dependencies that are actually installed.
- Prefer vertical end-to-end functionality over creating empty modules.
- Preserve existing user changes and inspect `git status` before editing.

### Mandatory brand rules

- Use **Supa Pro** as the product name in all new UI, documents, generated files, images, metadata, messages, and product copy. In Russian display copy, the established uppercase form **СУПА ПРО** is allowed.
- Historical project codenames are retired and must never be presented as current product names. The repository/folder name `pilot-plus` is a legacy technical identifier only.
- The approved product descriptor is **«система управления парком автомобилей»**.
- Never redraw, reinterpret, recolor, restyle, crop, distort, or substitute the Supa Pro logo or its mark. Reuse the approved production logo implementation/assets exactly as they exist.
- If the approved logo asset or implementation cannot be located with certainty, stop and ask the owner instead of inventing a placeholder.

## Token-efficient work (owner preference)

- Use targeted `rg` queries and bounded file excerpts; avoid dumping full files, logs, or directory trees unless required by an instruction.
- Reuse verified context from the current task. Do not reread unchanged instructions or repeat unchanged diagnostics without a concrete reason.
- Keep updates and final answers short: outcome, verification, and any blocker. Do not repeat the plan after every tool call.
- Batch related read-only checks and scoped edits when practical. Avoid frequent polling; use bounded waits and summarize only meaningful changes.
- Prefer one focused implementation and targeted regression tests. Do not generate extra design variants, introduce unrelated refactors, or deploy each cosmetic tweak separately unless requested.
- Efficiency must not skip required skill instructions, access checks, relevant tests, or honest verification. Never claim unperformed work is complete.
