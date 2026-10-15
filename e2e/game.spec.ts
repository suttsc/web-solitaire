import { expect, test, type Page } from '@playwright/test';

/** Seed 2 deals the ace of spades face up; seed 4 has 9♥ (column 3) that fits on 10♣ (column 1). */
const card = (page: Page, key: string) => page.locator(`[data-key="${key}"]`);

async function doubleTap(page: Page, key: string): Promise<void> {
  const box = await card(page, key).boundingBox();
  if (!box) throw new Error(`${key} not on the board`);
  await page.mouse.click(box.x + box.width / 2, box.y + 12);
  await page.mouse.click(box.x + box.width / 2, box.y + 12);
}

async function drag(page: Page, from: string, onto: string): Promise<void> {
  const a = await card(page, from).boundingBox();
  const b = await card(page, onto).boundingBox();
  if (!a || !b) throw new Error('card missing');
  await page.mouse.move(a.x + a.width / 2, a.y + 12);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + 40, { steps: 12 });
  await page.mouse.up();
}

const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

const hud = (page: Page, name: 'score' | 'time' | 'moves') => page.locator(`[data-hud="${name}"]`);

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('plays moves with double-tap, drag and undo', async ({ page }) => {
  await page.goto('/?seed=2');
  await doubleTap(page, 'S1');
  await expect(hud(page, 'moves')).toHaveText('1');
  await expect(hud(page, 'score')).toHaveText('15');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(hud(page, 'moves')).toHaveText('2');
  await expect(hud(page, 'score')).toHaveText('0');

  await page.goto('/?seed=4');
  await drag(page, 'H9', 'C10');
  await expect(hud(page, 'moves')).toHaveText('1');
  await settled(page);
  const [nine, ten] = await Promise.all([
    card(page, 'H9').boundingBox(),
    card(page, 'C10').boundingBox(),
  ]);
  expect(nine?.x).toBeCloseTo(ten?.x ?? NaN, 0);
});

test('resumes the same board after a reload, paused', async ({ page }) => {
  await page.goto('/?seed=2');
  await doubleTap(page, 'S1');
  await expect(hud(page, 'moves')).toHaveText('1');
  await settled(page);
  const before = await card(page, 'S1').boundingBox();

  await page.reload();
  await expect(page.getByRole('button', { name: /Paused/ })).toBeVisible();
  await page.getByRole('button', { name: /Paused/ }).click();
  await expect(hud(page, 'moves')).toHaveText('1');
  await settled(page);
  expect(await card(page, 'S1').boundingBox()).toEqual(before);
});

test('warns before redealing and records the abandoned game', async ({ page }) => {
  await page.goto('/?seed=2');
  await doubleTap(page, 'S1');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByRole('heading', { name: 'Moves are still available' })).toBeVisible();
  await page.getByRole('button', { name: 'Draw 3' }).click();
  await expect(hud(page, 'moves')).toHaveText('0');

  await page.getByRole('button', { name: 'Stats' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('Played', { exact: true }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('1');
});

test('still loads offline once installed', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(card(page, 'S1')).toBeAttached();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  await context.setOffline(false);
});
