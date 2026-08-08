# Image Compare Workbench

Client-side tool for inspecting **any pair of images from a larger set** while keeping a shared pan/zoom/wipe view.

The image set is the primary object. Side A and side B are temporary selections from that set. Changing A or B never moves the camera or wipe — so you can zoom into a feature, then cycle related frames without losing your place.

## Privacy

**Images stay in your browser. Nothing is uploaded.**

Import uses local `File` objects and object URLs only. There are no accounts, analytics, remote fonts, or network calls after the static app loads.

## Local development

```bash
npm install
npm run dev
```

Requires Node.js 22.12+ on the Node 22 line, or Node.js 24+ (see `.nvmrc`).

## Validation

```bash
npm run verify
npm run test:e2e
```

`verify` runs type checks, unit tests, the production build, and a Wrangler dry run.

## Production preview

```bash
npm run build
npm run preview
```

## Deployment (Cloudflare Workers)

**Live:** [image-compare-workbench.marshy-runner.workers.dev](https://image-compare-workbench.marshy-runner.workers.dev)

Production is a persistent, assets-only Worker owned by the maintainer's personal Cloudflare
account. Vite builds `dist/`; Wrangler deploys it with SPA fallback. No server-side handler,
binding, account secret, Durable Object, or image upload path is present yet.

```bash
# Validate the production build and Worker bundle without deploying.
npm run deploy:check

# Authenticate this machine when a manual production update is needed.
npx wrangler login
npm run deploy
```

For a git-connected Workers Build, use the repository root with build command `npm run verify` and
deploy command `npx wrangler deploy`. The checked-in `wrangler.jsonc` is the source of truth.

Use `npm run preview:cloudflare` when you want Wrangler's local serving behavior; ordinary UI work
can continue to use the faster `npm run dev` loop.

The persistent deployment can later host an API or Durable Object bridge by adding a Worker entry
point and routing only `/api/*` through it, while static assets remain asset-first.

## Browser behavior

| Capability | Notes |
|------------|--------|
| Multi-file import | Supported via file picker and drag-and-drop |
| Folder picker | Progressive enhancement (`showDirectoryPicker` or `webkitdirectory`) |
| Folder drag | Progressive enhancement via webkit directory entries |
| Formats | JPEG, PNG, WebP, GIF, AVIF (when the browser decodes it) |
| Unsupported | SVG, HEIC, RAW, EXR, PDF, video |
| Animation | Animated GIF/WebP may play in the viewport; phases are not synchronized |
| Architecture | Local object URLs + thumbnail blobs; domain state holds metadata only |

Folder import was designed for Chromium-style directory APIs. Ordinary multi-file import remains the reliable baseline when directory APIs are unavailable.

## Architecture

- **Functional domain core** — pure TypeScript for workspace transitions, camera math, sorting, wipe, and import policy. No DOM, File, or Svelte imports.
- **Effectful browser shell** — file enumeration, decode, thumbnails, object URL registry, application controller.
- **Serializable workspace** — asset metadata, selection, camera, comparison only.
- **Resource registry** — maps asset IDs to `File` + original/thumbnail object URLs with deterministic dispose.
- **Shared world camera** — one world unit = one source pixel; images centered at origin; one transform applied to both sides.
- **Latest-selection-wins** — per-side request tokens ignore stale decode completions during rapid cycling.

## Size normalization

Two **orthogonal** toolbar controls (aspect always preserved; not full registration):

**Basis** — what to equalize:

| Basis | Behavior |
|-------|----------|
| Native px | 1 world unit = 1 source pixel (reference ignored) |
| Height / Width / Max edge / Min edge | Equalize that dimension in world space |

**Reference** — who owns the target size:

| Reference | Behavior |
|-----------|----------|
| Both (max) | Both sides scale to the larger of A and B |
| Lock A | A stays native; B scales to A |
| Lock B | B stays native; A scales to B |

Example: **Height + Lock A** = old “Match A”. **Height + Both (max)** = old “Equal height”.

## Rails

If an image is selected as A, it appears **muted on the B rail** (and vice versa). Click the muted thumb to **swap A↔B**. Toolbar **⇄ Swap** / key `S` still available.

## View mode

Two orthogonal sticky axes:

| Axis | Values | Notes |
|------|--------|--------|
| **presentation** | Wipe \| Full | Mutually exclusive |
| **focus** | A \| B | Which full side is “home”; drives side-tap |

| Control | Behavior |
|---------|----------|
| **Full A/B** | Enter Full (keeps focus). Re-press flips focus A↔B. |
| **Wipe** | Presentation only — **does not change focus or A/B tap**. |
| **B tap** / **A tap** | Hold: show opposite of focus. Label depends on focus only. |

Hold **V** or the tap button. Same camera; wipe geometry unchanged.

## Wipe axis & lock

| Control | Options | Behavior |
|---------|---------|----------|
| **V / H** | Vertical (default) / Horizontal | V: A left, B right. H: A above, B below. 0 = all B, 1 = all A |
| **Wipe img** (default) | Image lock | Divider tracks world position through pan/zoom |
| **Wipe scr** | Screen lock | Divider fixed in viewport |

Original v0 was vertical + screen-fixed only.

## Keyboard

| Key | Action |
|-----|--------|
| `A` / `B` | Activate side |
| `↑` / `↓` | Cycle active side |
| `S` | Swap |
| `F` | Fit |
| `0` | 100% |
| `-` / `=` | Zoom out / in |
| `Space` + drag | Pan |
| `?` | Shortcuts |

## License

No license has been selected yet. All rights reserved unless otherwise stated.
