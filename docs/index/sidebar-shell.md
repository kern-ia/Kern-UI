# Sidebar shell — one structure for every client

## What

`AppShell.tsx`/`.module.css` rewritten: the header-with-centered-tabs layout is replaced
by a slim top bar (wordmark + current-view breadcrumb + status pills) over a body split
into a fixed sidebar (desktop, ≥900px) and a content pane. `ConversationStone` now mounts
inside the content pane, not the whole shell — "dock left" means the edge of the content
area, not past the sidebar. `DossiersView` becomes a real `<table>` (id / mission / étape
/ depuis / action), replacing its card grid.

## Why

The project owner's decision, after catching (twice) that the Avel advisor console only
reused Kern's existing top-tab chrome rather than the validated `avel-admin.dc.html`
mockup's actual layout: adopt the mockup's sidebar structure as the **one shell for the
whole app**, Kern's own brand included, going forward — so a third client later needs
only a token file and a copy file, never a new shell. See
`docs/index/theming-convention.md` and `docs/index/avel-advisor-console.md` for the two
prior, narrower passes this corrects.

## Kept deliberately, not carried over from the mockup verbatim

- **Accessibility semantics.** The mockup's sidebar items are bare `<div class="navitem">`
  with no ARIA role. Kept `role="tab"`/`aria-selected` and the two named `navigation`
  landmarks (`fr.nav.primary`/`fr.nav.compact`) instead — a mockup is a visual reference,
  not an accessibility spec. Consequence, verified rather than assumed: all 12 of
  `AppShell.test.tsx`'s existing tests passed **unmodified** after the rewrite, since they
  query by role and accessible name, never by CSS class or DOM nesting.
- **Mobile navigation.** The mockup has no responsive design at all for its sidebar
  (checked every `@media` query in it — only `prefers-color-scheme`,
  `prefers-reduced-motion`, and one unrelated content-collapse rule). Rather than invent a
  mobile sidebar behaviour with no source to ground it in, the existing, tested
  `mobileNav` bottom bar is kept exactly as it was, swapped in at the same 900px
  breakpoint that used to toggle the desktop tab row.
- **Per-content pattern, not "everything becomes a table."** Only `DossiersView` changed
  shape — it's the one view whose mockup counterpart is genuinely tabular. Grimoire
  (card-grid catalogue), Espace (stat tiles), Vigie (gauge + log feed), the Agents/Suivi
  Hive graph, and Rédaction/Marketing's bespoke editor and calendar are structurally
  unchanged — verified against the mockup's own repertoire (it draws a `.skills-grid`
  card grid for automations, not a table) before assuming a table was the right call
  everywhere.

## Left open, on purpose

CSS-only proportion tuning of Grimoire/Espace/Vigie's cards and HiveGraph's node-card
styling toward the mockup's exact padding/radius wasn't done in this pass — the earlier
Avel-console pass already verified these read correctly live (screenshotted), and the
concrete, twice-repeated complaint was about page *structure* (sidebar vs tabs, table vs
cards), not card proportions. A following, smaller pass, not dropped.

## Verified for real

`tsc -b` clean, 280 front tests green (12 in `AppShell.test.tsx` unmodified, 9 in
`DossiersView.test.tsx` including new table-row assertions), all Go packages green. Both
brand builds (`make build`, `VITE_BRAND=avel npm run build`) served by real `kern-ui`
instances side by side, screenshotted: sidebar and top bar render correctly in both
palettes. Re-ran the real dossier E2E flow from the prior pass — dispatched a real
`courtage-extraction` run with `dossier: "AF-2288"` against the running Avel build,
confirmed it renders as a real table row, opened it, confirmed the Hive timeline and
`ConversationStone` still work correctly inside the new content pane.
