---
name: html-review-artifacts
description: Create browser-openable, human-facing HTML review artifacts such as reports, annotated diffs, dashboards, comparison pages, research explainers, visual summaries, prototypes, and custom review pages. Use when Codex should pair a project's local DESIGN.md and styles.css to generate semantic HTML while minimizing tokens by reusing shared CSS instead of inline decorative styling.
---

# HTML Review Artifacts

Generate static HTML artifacts for human review. Treat Markdown as the working/spec format and HTML as the final review surface when layout, hierarchy, comparison, annotation, or visual scanning matters.

## Workflow

1. Read local `AGENTS.md` first if present.
2. Inspect local `styles.css` to learn available classes and reusable components.
3. Read `DESIGN.md` only for visual direction, token intent, and component constraints. Do not copy large design prose into the artifact.
4. If starting a new artifact, use `assets/review-template.html` as the skeleton.
5. Generate shallow semantic HTML that links the project's stylesheet:

```html
<link rel="stylesheet" href="./styles.css">
```

6. Reuse existing classes before adding new CSS. Add new shared classes only when a needed reusable pattern is missing.
7. Keep the artifact standalone and browser-openable without a build step.
8. Before finalizing, use `references/validation-checklist.md`.

## Output Rules

- Do not inline decorative CSS or repeat theme tokens.
- Do not add a large `<style>` block unless the user explicitly requests a one-file artifact.
- Use semantic structure: `main`, `nav`, `header`, `section`, `article`, `footer`, `div`, and `span`.
- Prefer reusable review classes such as `report-shell`, `top-nav`, `hero-photo-band`, `section`, `section-header`, `grid`, `card`, `spec-grid`, `spec-cell`, `badge`, `callout`, `comparison-grid`, `timeline`, `diff`, and `action-list`.
- Use HTML for human-facing review pages: findings, risks, decisions, diffs, timelines, dashboards, explainers, and visual summaries.
- Use Markdown for agent memory, task specs, durable notes, and machine-readable plans.

## CSS Change Policy

- If `styles.css` already has a suitable class, use it exactly.
- If a pattern is missing and will likely recur, add a small reusable class to `styles.css`.
- If a pattern is truly one-off, prefer simpler markup over new styling.
- Keep new CSS token-based and consistent with `DESIGN.md`.
- Keep border radius, spacing, typography, and color decisions aligned with the local design source.

## Review Artifact Shape

Use this structure unless the task demands otherwise:

- Nav or compact header naming the artifact.
- Hero or summary section with the main decision/result.
- Body sections grouped by reviewer intent, not by implementation noise.
- Cards for repeated items.
- Badges for severity/status.
- Comparison grids for tradeoffs.
- Timelines for sequence.
- Diff blocks for code or behavior changes.
- Action list for next steps.
