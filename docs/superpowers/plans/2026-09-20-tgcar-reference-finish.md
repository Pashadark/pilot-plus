# TG CAR reference finish

Approved by user: execute the previously proposed Ingosstrakh-inspired design, preserving TG CAR content and full-width square-corner city hero. Remove generic all-cars icon. Remove internal-system copy. First vehicle pictures use white backgrounds.

Implementation order:
- Preserve current real fleet, booking validation, tenant integration and form consent.
- Add an isolated reference-theme.css loaded after existing styles: neutral #f6f6f6 surface, white rounded cards without decorative shadows, blue primary and pale-blue secondary controls, 32px/600 section headings, regular body type, consistent spacing, mobile stacking.
- Use approved existing Manrope rather than copying proprietary Ingo Stem font files.
- Edit existing first vehicle photos with imagegen, preserving identity and original files. Map derivatives by vehicle ID, never model name. Unknown/missing photos retain the honest placeholder.
- Add regression tests for photo fallback and removed generic icon, run full tests and build.
- Inspect desktop and mobile, deploy isolated frontend release, verify HTTPS. No SUPA database or internal service modifications.
