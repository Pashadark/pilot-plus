# TG CAR: subdued brand marks and white hero

Approved voice brief: gray brand logos in the primary vehicle picker; restore the promotional car on white. Keep filters, inventory, forms, and internal SUPA unchanged.

Implementation: reuse react-icons brand vectors with visible text labels and decorative SVG semantics. Generate a sibling white-background hero asset, preserving the existing source. Use a right-hand contained image on desktop and stacked image on mobile.

Verification: regression test first (failed before implementation), then 37 passing tests and successful Next build. Desktop screenshot inspected. At mobile width 390, document content is 375px, hero image 375px, logos 38px: no horizontal overflow. Mechanical design detector returned no findings.

Asset: apps/tgcar/public/images/hero-white.png. Built-in imagegen edit of bmw.png. Prompt: replace city and pavement with pure white seamless studio background and a soft tire contact shadow; preserve black sedan, front three-quarter angle facing right, complete wheels and body; no text or added objects, white at all edges.

Deployment: isolated TG CAR release 20260920-brand-white. Previous release 20260920-public-v2 retained. No internal application or database changes.
