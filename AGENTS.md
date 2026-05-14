# Agent HTML Output Rules

Use this project as a reusable pattern for human-facing agent artifacts.

- Use `$html-review-artifacts` when creating human-review HTML deliverables.
- Generate standalone semantic HTML when the deliverable is meant for human review.
- Always link `./styles.css`; do not inline decorative CSS or repeat theme tokens.
- Keep HTML shallow and semantic: `main`, `nav`, `header`, `section`, `article`, `footer`, `div`, and `span` are enough for most artifacts.
- Use Markdown for agent memory, specs, plans, and durable working notes.
- Use HTML for rich review surfaces: annotated diffs, comparisons, timelines, dashboards, reports, prototypes, explainers, and custom editors.
- Prefer existing classes from `styles.css` before creating new one-off classes.
- Follow `DESIGN.md` for visual direction: black canvas, high-contrast text, sharp rectangles, sparse M tricolor accents, and no rounded decorative cards.
- Future HTML files must open directly in a browser without a build step.
