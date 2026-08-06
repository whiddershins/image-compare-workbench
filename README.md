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

Requires Node.js 22+ (see `.nvmrc`).

## Validation

```bash
npm run check
npm run test
npm run test:e2e
npm run build
```

## Production preview

```bash
npm run build
npm run preview
```

## Deployment (Cloudflare Pages)

| Setting | Value |
|--------|--------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | repository root |
| Environment variables | none |

Connect the GitHub repository in the Cloudflare Pages dashboard. No Workers or Functions are required.

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

Different resolutions of the same composition will not overlay in **Native px** mode (true pixel sizes). Use the toolbar control:

| Mode | Behavior |
|------|----------|
| Native px | 1 world unit = 1 source pixel |
| Equal height / width / max edge | Scale both sides so that dimension matches |
| Match A / Match B | Reference side stays native; the other scales to its height |

Aspect ratio is always preserved (no stretch). This is size normalization only — not manual alignment or registration.

## Wipe lock

| Mode | Toolbar | Behavior |
|------|---------|----------|
| Image (default) | **Wipe img** | Divider stays on the same world/image X through pan and zoom |
| Screen | **Wipe scr** | Divider stays fixed in the viewport; content slides under it |

Original v0 was screen-fixed only; image-locked is now the default for inspection.

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
