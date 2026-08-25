# Image Compare Workbench

Drop a folder of images. Click a reference on one rail, click candidates on the other. The camera stays put.

**Canonical:** https://contraptions.bookofsarth.com/image-compare-workbench
**Live:** https://image-compare-workbench.marshy-runner.workers.dev
**Shelf:** https://contraptions.bookofsarth.com
**Source:** https://github.com/whiddershins/image-compare-workbench
**Sarth:** https://sarth.net
**Tech:** [TECH.md](./TECH.md) · **Design:** [DESIGN.md](./DESIGN.md)

Hosted on Cloudflare Workers. Images never leave the browser.

## How to use

Drop a folder, or pick files. One shared pool fills both rails.

Click a thumb on the A rail, click a thumb on the B rail. Pan, zoom, wipe. Click another candidate. The view does not reset.

If a thumb is already A, it shows muted on B (and the other way around). Click the muted thumb to swap. `S` swaps too.

**Wipe**: drag the divider, or drag the image under a held divider (hybrid). `V` / `H` for vertical or horizontal. Wipe can lock to the screen, lock to the image, or hybrid.

**Full A/B**: one side fills the view. Tap or hold to flip. **A|B** is side by side, same camera.

**Size**: two dials. Which dimension to equalize (height, width, max edge, min edge, native pixels). Who owns the size (both/max, lock A, lock B). Height + lock A is “match A.”

Keyboard: `A` / `B` pick a side, arrows cycle, `F` fit, `0` actual size, `-` / `=` zoom, space-drag pan, `?` shortcuts.

Folder import uses Chromium directory APIs when they exist. Multi-file pick always works. JPEG, PNG, WebP, GIF, AVIF. Not SVG, HEIC, RAW, EXR, PDF, or video.

## What it is

The image set is the object. A and B are two picks from that set, not two folders.

Two click-rails over one pool, so both sides of the comparison are one click away. Not a modifier-click, not a dropdown, not `Ctrl+1-9`.

One shared pan/zoom/wipe. Change A or B and you stay on the feature you were looking at.

Wipe anchoring is a choice: screen, image, or hybrid (drag pans under a held wipe; the wheel carries the wipe with the image).

Size matching is two dials, so a 1024 gen overlays a 4K upscale the way you mean it.

Used at Third Wall Studio. The A-folder vs B-folder split is not a missing feature. See [DESIGN.md](./DESIGN.md).

## Why

I wanted the whole loop in one place: folder in, reference on one rail, candidates on the other, stay where you are. Camera never resets. Wipe never jumps. Nothing uploaded.

The two-file slider is a solved widget. This is a workbench for a *set*.

## Context

The two products I sat with are [imgsli](https://imgsli.com/) and [Improve ImgSLI](https://github.com/Loganavter/Improve-ImgSLI).

imgsli is a web album with a slider. You pick from a set. It uploads.

Improve ImgSLI puts selectable lists on both sides of a shared compare. Arbitrary pairs already exist there.

This workbench is that browsing model as the whole instrument: one local pool, two independent click-rails, camera stays, nothing uploaded. Part of [Contraptions](https://contraptions.bookofsarth.com/). Related: [Burlap](https://burlap.app), used at [Third Wall Studio](https://thirdwallstudio.com).

## Privacy

Images stay in the browser. Local `File` objects and object URLs. No accounts, no analytics, no upload.

## Local development

Node 22.12+ or Node 24 (see `.nvmrc`). Install with the usual Node tools, then the dev script. The verify script covers types, unit tests, production build, and a Wrangler dry run. `wrangler.jsonc` is the source of truth. Assets-only Worker. No Durable Object, no image upload path.

## Architecture

Functional domain core: TypeScript for workspace, camera, sorting, wipe, import policy. No DOM, File, or Svelte. Browser shell: files, decode, thumbnails, object URLs. Shared world camera: one world unit is one source pixel, one transform on both sides. Latest-selection-wins: stale decode completions are ignored while you cycle.

## License

All rights reserved.
