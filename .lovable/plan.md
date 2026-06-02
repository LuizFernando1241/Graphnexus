## Accessibility fixes

Audit results show two real issues. The authenticated app (`AppLayout`) already wraps content in `<main>`, but public pages and a few low-contrast elements don't comply.

### 1. Add `<main>` landmark to public/standalone pages
Currently missing on:
- `src/pages/Login.tsx` — wrap the card container in `<main>` (replace outer `<div>`).
- `src/pages/Signup.tsx` — same treatment.
- `src/pages/NotFound.tsx` — wrap the centered content in `<main>`.

This lets screen-reader users jump straight to the main content with the standard landmark shortcut.

### 2. Raise text contrast
Replace low-opacity tokens that fall below WCAG AA:
- `src/pages/Graph.tsx` line 172: search icon `text-white/50` → `text-muted-foreground`.
- `src/pages/Graph.tsx` line 553: loading fallback `text-white/50` → `text-muted-foreground`.
- `src/components/tasks/views/ListView.tsx` line 210: empty-state sparkle icon `text-muted-foreground/40` → `text-muted-foreground` (decorative but still visible).

### 3. Verify
After the edits, re-scan with `rg` to confirm no remaining `text-white/[1-5]0` or `text-muted-foreground/[1-4]0` on text content, and that each top-level page renders exactly one `<main>`.

### Out of scope
No business-logic changes; purely presentational (className + semantic element swaps).
