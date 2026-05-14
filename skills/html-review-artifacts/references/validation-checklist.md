# HTML Review Artifact Validation Checklist

Use before finalizing a generated HTML review artifact.

## Token Savings

- The artifact links `./styles.css`.
- There is no large decorative `<style>` block.
- Existing stylesheet classes are reused before new classes are introduced.
- `DESIGN.md` informs the visual choices but is not copied into the HTML.
- Repeated UI patterns use shared classes instead of inline styles.

## HTML Structure

- The file is standalone and browser-openable.
- Markup is shallow and semantic.
- Sections are grouped by reviewer intent.
- Navigation links point to real section IDs when present.
- Images or media are used only when they materially improve review.

## Review Quality

- The first viewport makes the artifact purpose clear.
- Severity/status uses badges or equivalent visual hierarchy.
- Comparisons use a comparison grid.
- Sequences use a timeline.
- Code or behavior changes use a diff block when helpful.
- Next actions are concrete and grouped in an action list.

## Visual Consistency

- Styling follows local `DESIGN.md`.
- Colors, spacing, type, and radius match the existing `styles.css`.
- The result avoids one-off decorative classes unless they are promoted to reusable CSS.
- Text fits in cards, buttons, badges, and narrow mobile layouts.
