import { expect, test, type Page } from '@playwright/test';

/** The font a face-up card is currently drawn with. */
const cardFont = (page: Page) =>
  page.locator('[data-key] svg text').first().getAttribute('font-family');

test('opening settings does not focus the name field', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Your name')).not.toBeFocused();
});

test('previews card styles on the table, then cancels or saves', async ({ page }) => {
  await page.goto('/?seed=2');
  expect(await cardFont(page)).toContain('Georgia');

  const open = async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: /^Card style/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'New game' })).toBeHidden();
  };

  // Preview, then cancel: the original style comes back.
  await open();
  await page.getByLabel('Card style', { exact: true }).selectOption('victorian');
  await expect.poll(() => cardFont(page)).toContain('IM Fell');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect.poll(() => cardFont(page)).toContain('Georgia');
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();

  // Preview, then save: it sticks across a reload.
  await open();
  await page.getByLabel('Card style', { exact: true }).selectOption('casino');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => cardFont(page)).toContain('Oswald');
  await page.reload();
  await expect.poll(() => cardFont(page)).toContain('Oswald');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Card style: Casino' })).toBeVisible();
});
