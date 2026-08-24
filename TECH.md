# Image Compare Workbench — tech

Svelte 5 + Vite + TypeScript. Client-only. Images are File objects and blob URLs. Nothing is uploaded.

Hosted on Cloudflare Workers (assets-only SPA, Wrangler). No Durable Object, no D1, no auth, no API.

- Canonical: https://contraptions.bookofsarth.com/image-compare-workbench
- Live: https://image-compare-workbench.marshy-runner.workers.dev
- Source: https://github.com/whiddershins/image-compare-workbench
- Shelf: https://contraptions.bookofsarth.com
- Sarth: https://sarth.net

The image set is the primary object. A and B are two pickers on the same pool. See DESIGN.md.

Domain math is pure TypeScript (`src/domain/`). The browser shell enumerates files, decodes, thumbs, and holds object URLs. Wipe is CSS clip-path on a shared camera, not a pixel buffer.
