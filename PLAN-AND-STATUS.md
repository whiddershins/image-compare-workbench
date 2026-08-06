# Image Compare Workbench — Plan & Status

**Audience:** humans and coding agents continuing this work (deploy, QA, review, fixups).

**Last updated:** 2026-08-06  
**Branch:** `main` @ `5ed4de3` — *Build image comparison workbench v0*  
**Local path:** `/Users/burlapcalhoun/git_repos/image-compare-workbench`  
**GitHub (private):** https://github.com/whiddershins/image-compare-workbench  
**Cloudflare Pages URL:** *not deployed yet*

This document is the handoff. The product README is for end users; this file is for implementers.

---

## 1. Product intent (one paragraph)

Client-side tool for inspecting **any pair from a larger local image set** while **keeping pan, zoom, and wipe** when A or B changes. The image set is primary; A/B are temporary selections. Not an upload form + before/after widget.

Full original v0 specification lived in the implementing agent’s prompt (Image Compare Workbench v0). Key constraints: pure domain core, no backend, no React/SvelteKit, no WebGL, CSS wipe compositor, local `File` + object URLs only.

---

## 2. Status snapshot

| Area | Status | Notes |
|------|--------|--------|
| Repo scaffold (Svelte + Vite + TS strict) | **Done** | Not SvelteKit |
| Domain layer (pure TS) | **Done** | See `src/domain/` |
| Browser shell (import, decode, thumbs, registry) | **Done** | See `src/infrastructure/`, `src/application/` |
| UI (empty drop, rails, viewport, wipe, toolbar) | **Done** | See `src/ui/`, `src/App.svelte` |
| Unit tests (Vitest) | **Done** | 36 tests, all green at commit |
| E2E (Playwright / Chromium) | **Done** | 5 tests, all green at commit |
| CI (GitHub Actions) | **Done** | `.github/workflows/ci.yml` |
| README | **Done** | User-facing |
| GitHub private remote + push | **Done** | `origin` → whiddershins/image-compare-workbench |
| Cloudflare Pages deploy | **Not done** | No CF auth in implementing session |
| Manual Safari / Firefox | **Not done** | Only Chromium via Playwright |
| Manual folder-picker / folder-drag | **Not done** | Code present; not verified by hand |
| Transparent-pixel visual e2e | **Partial** | Compositor implements checkerboard; no pixel assertion in Playwright |
| License | **None** | Spec: do not add unless selected |

### Validation last known green

```bash
npm run check    # svelte-check + tsc
npm run test     # vitest (36)
npm run test:e2e # playwright chromium (5)
npm run build    # dist/
```

Re-run these before trusting the tree; do not claim green without running.

---

## 3. Architecture map

```text
browser event
  → WorkspaceController (src/application/workspaceController.ts)
  → pure domain transition (src/domain/*)
  → Workspace state
  → Svelte renders (src/App.svelte, src/ui/*)
```

| Layer | Path | Rules |
|-------|------|--------|
| Domain | `src/domain/` | No Svelte, DOM, File, Blob, URL, storage, network |
| Application | `src/application/` | Orchestrates import, selection load tokens, controller |
| Infrastructure | `src/infrastructure/browser/` | Enumerate files, decode, thumbnails, resource registry |
| UI | `src/ui/`, `src/App.svelte` | Presentation; call controller; do not reimplement domain math |

### Domain vocabulary

Workspace · Image Set · Image Asset · Side A/B · Selection · Camera · Wipe · Import Batch · Import Issue

### Hard invariants (must stay true)

1. Selection change does **not** alter camera center, scale, or wipe.
2. Swap does **not** alter camera or wipe (and does **not** invert wipe).
3. Append to nonempty workspace does **not** change selection/camera/wipe.
4. Clear empties set, clears selection/camera, resets wipe to 0.5, disposes all object URLs.
5. Wipe: `0` = all B, `1` = all A; A is left of divider.
6. World: 1 unit = 1 source pixel; each image centered at `(0,0)`.
7. Domain state has no browser handles; registry is `AssetId → { file, originalUrl, thumbnailUrl, dispose }`.
8. Latest-selection-wins on each side via tokens in `SelectionLoader`.

### Comparison stacking (v0)

```text
viewport
  scene B (full)
  clipped wrapper (viewport coords, clip-path)
    scene A
  wipe divider (viewport overlay)
  labels
```

Transparent A must show A’s checkerboard, not B.

---

## 4. What was implemented

### Import

- Multi-file picker, drag-and-drop, folder picker (`showDirectoryPicker` or `webkitdirectory`), folder drop via webkit entries.
- Partial success + typed `ImportIssue`s; duplicate skip by path+size+mtime.
- Bounded concurrent decode/thumbnail (4); thumbs max edge 256.
- Append never replaces the set; explicit Clear only.

### Interaction

- Dual rails, independent A/B, active side, keyboard cycle (↑↓), A/B/S/F/0/-/=/?/Space-pan.
- Shared camera pan/zoom; Fit; 100%; wipe drag + keyboard slider.
- Initial fit only after first import into empty workspace (once viewport measured).
- ResizeObserver on viewport; resize does not refit.

### Quality gates in repo

- `package.json` scripts: `dev`, `build`, `preview`, `check`, `test`, `test:e2e`
- `.nvmrc` → `22`; `engines.node` ≥ 22
- CI: `npm ci` → check → test → build → Playwright chromium

---

## 5. Open work for other agents

### P0 — Cloudflare Pages deploy

**Goal:** Live static site from this private GitHub repo.

**Settings (normative):**

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |
| Env vars | none |
| Framework preset | Vite (or None) |

**Suggested steps:**

1. Confirm auth: `wrangler whoami` or Cloudflare dashboard login for the target account.
2. Create Pages project linked to `whiddershins/image-compare-workbench` (or deploy via wrangler):
   ```bash
   # Example if using Wrangler + direct upload after build:
   npm ci && npm run build
   npx wrangler pages project create image-compare-workbench --production-branch main
   npx wrangler pages deploy dist --project-name=image-compare-workbench
   ```
   Prefer Git-connected project so pushes to `main` auto-deploy.
3. After first deploy, record production URL in this file and README.
4. Smoke: open URL, import local images, confirm no network POSTs of image bytes (DevTools).
5. Do **not** add Workers, Functions, or a second deploy path (e.g. GitHub Pages) in v0.

**When done, update:**

- This file: Cloudflare URL + date
- README Deployment section if the live URL should be listed

### P1 — Manual browser / folder QA

Checklist (check boxes when actually done):

- [ ] Safari (current macOS): multi-file import, wipe, pan, zoom, keyboard cycle
- [ ] Chrome (macOS): same + folder picker + folder drag
- [ ] Firefox (macOS): multi-file import; note folder API support
- [ ] Nested folder paths retained in tooltips/labels
- [ ] Transparent PNG: A transparency shows checkerboard, not B
- [ ] Differently sized images not stretched
- [ ] ~100 ordinary photos still responsive
- [ ] Corrupt / unsupported files produce summary, no crash
- [ ] Rapid keyboard cycling: no obsolete image “winning” late

Document observed folder behavior in README “Browser behavior” table (spec requires honesty: only claim what was tested).

### P2 — Test gaps vs original acceptance

Worth adding if tightening v0:

- [ ] Playwright: rapid B cycling with delayed image load (assert label/token)
- [ ] Playwright: transparent A vs opaque B pixel sample (or screenshot baseline)
- [ ] E2E assert camera center not only zoom % (expose `data-camera-*` for tests only, or evaluate via app debug hook)
- [ ] Unit: more geometry edge cases (zero viewport, extreme scales)

### P3 — Polish / fixups (non-blocking)

- [ ] Silence or structure any remaining a11y noise if reintroduced
- [ ] Confirm `dist/` not committed (gitignored) — currently ignored
- [ ] Optional: remove empty sibling experiment dir `../checkitout` if unused (outside this repo)

### P4 — Viewport pointer / drag-selection UX (undecided)

**Symptom:** Easy to fall into browser drag-selection over the comparison area (blue selection wash). Hard to exit; pan/wipe feel stuck. Not an intentional app mode.

**Likely causes:** free left-drag pan collides with native selection; incomplete `user-select` / `selectstart` / image-drag suppression; no Escape-to-clear.

**Options (product owner undecided):**

1. Keep free left-drag pan + fully suppress selection (`user-select: none`, clear selection on pointerdown, Escape clears).
2. Space / middle-button only for pan (stricter).
3. Both free pan + Space pan with full selection suppression.

**Do not “fix” casually without choosing a model.** Note for a future pass; not blocking deploy.

### P5 — Wipe lock (implemented 2026-08-06)

- **Default:** `world` — wipe tracks fixed world X through pan/zoom (same place on images).
- **Toggle:** `viewport` — wipe fixed in screen space (original v0).
- Toolbar button: **Wipe img** / **Wipe scr**.
- Domain: `src/domain/wipe.ts`; `ComparisonState.lock` + `worldX`.

### Out of scope for v0 (do not implement casually)

Rotatable wipe, fade, blink, difference modes, alignment/registration, masks, SAM, annotations, export, persistence, accounts, cloud, analytics, video, EXR/RAW/HEIC/SVG, backend, plugin framework.

Leave seams only: shared camera separate from per-image placement; single comparison render boundary.

---

## 6. How to verify someone’s work

### Quick gate (required before merge/ship)

```bash
cd /Users/burlapcalhoun/git_repos/image-compare-workbench
npm ci
npm run check
npm run test
npm run test:e2e
npm run build
```

### Domain invariant smoke (unit)

Covered in `tests/unit/selection.test.ts`, `camera.test.ts`, `selectionLoader.test.ts`:

- select A/B preserves camera object + wipe
- swap / append preserve view state
- latest-wins ignores stale tokens
- wipe clamps 0…1

### Core product invariant (manual or e2e)

1. Load ≥10 images  
2. A = image 1, B = image 2  
3. Zoom deep, pan feature to center, set wipe  
4. Change B through several images + rapid keyboard cycle  
5. Change A while holding B  

Throughout: camera center/scale and wipe unchanged; fixed side fixed.

E2E approximation: `tests/e2e/core-workflow.spec.ts` (zoom % + wipe ARIA as proxies).

### Architecture review checklist

- [ ] No domain import of DOM/Svelte/File  
- [ ] No canonical selection/camera/wipe logic duplicated inside components  
- [ ] Registry owns revoke; Clear leaves no orphan object URLs  
- [ ] Rails use thumbnail URLs only  
- [ ] Full-res only for current/pending A/B  
- [ ] No analytics, remote fonts, service worker, upload API  

### Privacy review

After static assets load, import/compare must not initiate external network requests or POST image bytes.

---

## 7. Implementation decisions / departures

Recorded for reviewers:

1. **Svelte 5** (Vite template default) with runes — not Svelte 4.  
2. **Node:** `.nvmrc` pins **22** (LTS target); implementing host had Node 25.9.0. CI uses `.nvmrc`.  
3. Full-resolution display uses object URLs (available immediately); `SelectionLoader` tokens still gate presentation races during rapid cycling. Browser native decode of `<img>` may still finish out of order; labels/loading state track selection id.  
4. E2E asserts wipe via `aria-valuenow` and camera scale via zoom percentage label — not full `{centerX, centerY, scale}` identity (unit tests cover that).  
5. Empty-state and toolbar both wire folder APIs with progressive enhancement.  
6. No license file.

---

## 8. Key file index

```text
src/domain/
  model.ts                 # Workspace, assets, camera, wipe, ImportIssue
  result.ts                # Result<T,E>
  workspaceTransitions.ts  # select, cycle, swap, append, clear, wipe
  geometry.ts / camera.ts  # world↔screen, fit, zoom-at-point, pan
  sorting.ts               # natural sort
  importPolicy.ts          # formats, duplicates, issue summary

src/application/
  workspaceController.ts   # effectful shell API for UI
  importBatch.ts           # concurrent decode/thumb pipeline
  selectionLoader.ts       # per-side tokens

src/infrastructure/browser/
  enumerateFiles.ts
  decodeImage.ts
  createThumbnail.ts
  assetResourceRegistry.ts

src/ui/components/         # DropZone, rails, viewport, wipe, toolbar, help
src/App.svelte             # layout + keyboard

tests/unit/                # pure + registry + loader
tests/e2e/                 # Playwright + PNG fixtures
.github/workflows/ci.yml
```

---

## 9. Agent playbooks

### “Deploy to Cloudflare”

1. Read §5 P0.  
2. Authenticate Cloudflare.  
3. Deploy or connect Git; get URL.  
4. Smoke import on production.  
5. Update §2 table + Cloudflare URL in this file and commit.  

### “Review v0 completeness”

1. Run §6 quick gate.  
2. Walk §6 architecture + privacy checklists against `src/`.  
3. Compare §5 open work; do not reopen excluded features.  
4. File issues or fix only P1–P2 gaps if asked.  

### “Fix a bug without breaking the product”

1. Prefer pure domain fix under `src/domain/` with a unit test.  
2. Never auto-fit on selection.  
3. Never put File/Blob into `Workspace`.  
4. Re-run full gate before commit.  

### “Add a feature”

If the feature is in §5 “Out of scope”, refuse or escalate unless product owner expands scope. Prefer seams over speculative frameworks.

---

## 10. Commit / remote state at handoff

```text
Commit:  5ed4de3 Build image comparison workbench v0
Branch:  main
Remote:  origin = https://github.com/whiddershins/image-compare-workbench.git
Tree:    clean after initial commit (update this section when you change it)
```

When you land deploy or QA, append a short **Changelog** subsection below rather than deleting history.

### Changelog

- **2026-08-06** — v0 implemented, tests green, private GitHub created, Cloudflare not yet deployed. This plan/status doc added.
- **2026-08-06** — **Size normalization modes** added (post-v0): toolbar control for `native` | `equal-height` | `equal-width` | `equal-max-edge` | `match-a` | `match-b`. Per-image uniform scale into shared world space so same-composition different-resolution frames can overlay. Domain: `src/domain/sizeNormalization.ts`; mode on `Workspace.sizeNormalization`. Changing mode refits pair; selection still does not move camera. Not full registration/alignment.
- **2026-08-06** — **Wipe lock** default `world` (image-fixed through zoom/pan); toggle to `viewport` (screen-fixed). Follow-on noted for browser drag-selection UX (P4, undecided).
