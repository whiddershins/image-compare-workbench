import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, 'fixtures');

function fixtureFiles(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    path.join(fixtures, `image${i + 1}.png`),
  );
}

async function importImages(page: import('@playwright/test').Page, files: string[]) {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(files);
  await expect(page.getByTestId('compare-viewport')).toBeVisible({
    timeout: 15_000,
  });
  // Wait for rails
  await expect(page.locator('.rail[data-side="a"] .thumb').first()).toBeVisible();
}

async function readCameraAndWipe(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    // Access via DOM labels and wipe ARIA
    const wipe = document.querySelector('[data-testid="wipe-divider"]');
    const wipeNow = wipe?.getAttribute('aria-valuenow');
    const zoom = document.querySelector('[data-testid="zoom-pct"]')?.textContent;
    // Store camera on window from data attributes if we expose them
    const labelA = document.querySelector('[data-testid="label-a"]')?.textContent;
    const labelB = document.querySelector('[data-testid="label-b"]')?.textContent;
    return { wipeNow, zoom, labelA, labelB };
  });
}

test.describe('core comparison invariant', () => {
  test('selection changes preserve camera and wipe', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Drop images or a folder here')).toBeVisible();

    await importImages(page, fixtureFiles(10));

    // Select image 1 as A, image 2 as B (initial may already be that)
    const railA = page.locator('.rail[data-side="a"]');
    const railB = page.locator('.rail[data-side="b"]');
    await railA.locator('.thumb').nth(0).click();
    await railB.locator('.thumb').nth(1).click();

    const viewport = page.getByTestId('compare-viewport');
    const box = await viewport.boundingBox();
    expect(box).toBeTruthy();

    // Zoom deeply (ctrl+wheel)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, -300);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');

    // Pan
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 40, box!.y + box!.height / 2 + 30);
    await page.mouse.up();

    // Move wipe via keyboard
    const wipe = page.getByTestId('wipe-divider');
    await wipe.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    const before = await readCameraAndWipe(page);
    const zoomBefore = before.zoom;
    const wipeBefore = before.wipeNow;
    const labelABefore = before.labelA;

    // Select images 3, 4, 5 as B
    await railB.locator('.thumb').nth(2).click();
    await railB.locator('.thumb').nth(3).click();
    await railB.locator('.thumb').nth(4).click();

    const afterB = await readCameraAndWipe(page);
    expect(afterB.zoom).toBe(zoomBefore);
    expect(afterB.wipeNow).toBe(wipeBefore);
    expect(afterB.labelA).toBe(labelABefore);
    expect(afterB.labelB).not.toBe(before.labelB);

    // Activate A and cycle
    await page.keyboard.press('a');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    const afterA = await readCameraAndWipe(page);
    expect(afterA.zoom).toBe(zoomBefore);
    expect(afterA.wipeNow).toBe(wipeBefore);
    // B should remain the last selected on B (image 5 / index 4)
    expect(afterA.labelB).toBe(afterB.labelB);
  });

  test('swap preserves camera and wipe', async ({ page }) => {
    await page.goto('/');
    await importImages(page, fixtureFiles(4));

    const viewport = page.getByTestId('compare-viewport');
    const box = await viewport.boundingBox();
    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -150);
    await page.keyboard.up('Control');

    const wipe = page.getByTestId('wipe-divider');
    await wipe.focus();
    await page.keyboard.press('End'); // wipe = 1

    const before = await readCameraAndWipe(page);
    await page.getByTestId('swap-btn').click();
    const after = await readCameraAndWipe(page);
    expect(after.zoom).toBe(before.zoom);
    expect(after.wipeNow).toBe(before.wipeNow);
  });

  test('append does not reset view', async ({ page }) => {
    await page.goto('/');
    await importImages(page, fixtureFiles(3));

    await page.getByTestId('zoom-100-btn').click();
    const before = await readCameraAndWipe(page);

    // Append via multi-file input (not webkitdirectory)
    const fileInput = page.locator('input[type="file"]:not([webkitdirectory])').last();
    await fileInput.setInputFiles([
      path.join(fixtures, 'image11.png'),
      path.join(fixtures, 'image12.png'),
    ]);

    await expect(page.locator('.rail[data-side="a"] .thumb')).toHaveCount(5, {
      timeout: 10_000,
    });
    const after = await readCameraAndWipe(page);
    expect(after.zoom).toBe(before.zoom);
  });

  test('no network upload after local import', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      // Allow only same-origin static assets
      if (!url.startsWith('http://127.0.0.1:4173') && !url.startsWith('blob:')) {
        requests.push(url);
      }
      // blob: is fine; also track any POST
      if (req.method() === 'POST') {
        requests.push(`POST ${url}`);
      }
    });

    await page.goto('/');
    await importImages(page, fixtureFiles(5));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.getByTestId('swap-btn').click();

    const posts = requests.filter((r) => r.startsWith('POST'));
    expect(posts).toHaveLength(0);
    // No external hosts
    const external = requests.filter(
      (r) =>
        !r.startsWith('http://127.0.0.1') &&
        !r.startsWith('blob:') &&
        !r.startsWith('POST'),
    );
    expect(external).toHaveLength(0);
  });

  test('rails use thumbnail resources not originals for list', async ({
    page,
  }) => {
    await page.goto('/');
    await importImages(page, fixtureFiles(3));

    const railImgs = page.locator('.rail img');
    const count = await railImgs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const src = await railImgs.nth(i).getAttribute('src');
      expect(src).toMatch(/^blob:/);
    }
    // Viewport images also blob — but thumbnails should be distinct blobs.
    // We verify rail images are not full-size by checking natural sizes vs max 256
    const sizes = await railImgs.evaluateAll((imgs) =>
      imgs.map((img) => ({
        nw: (img as HTMLImageElement).naturalWidth,
        nh: (img as HTMLImageElement).naturalHeight,
      })),
    );
    for (const s of sizes) {
      expect(Math.max(s.nw, s.nh)).toBeLessThanOrEqual(256);
    }
  });

  test('empty-state imports report unsupported files', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(page.getByText('1 unsupported')).toBeVisible();
    await expect(page.getByText('Drop images or a folder here')).toBeVisible();
  });

  test('focused controls keep native keys and help closes with Escape', async ({
    page,
  }) => {
    await page.goto('/');
    await importImages(page, fixtureFiles(2));

    const clear = page.getByTestId('clear-btn');
    await clear.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('Drop images or a folder here')).toBeVisible();

    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(help).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
  });
});
