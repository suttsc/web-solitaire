import { expect, test, type Page } from '@playwright/test';
import { applyMove, deal, solve, type GameState, type Move } from '../src/engine';
import { cardKey } from '../src/ui/layout';

const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

/** Tap a card or empty slot by its element, as a player would. */
async function tap(page: Page, selector: string): Promise<void> {
  await settled(page);
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`Nothing at ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(12, box.height / 2));
}

const slot = (kind: string, index?: number) =>
  `[data-slot='${JSON.stringify(index === undefined ? { kind } : { kind, index })}']`;

function topKey(cards: GameState['waste']): string | null {
  const top = cards.at(-1);
  return top ? cardKey(top) : null;
}

/** Translate an engine move into taps: select the source card, then tap the target pile. */
async function perform(page: Page, state: GameState, move: Move): Promise<void> {
  const cardSel = (key: string) => `[data-key="${key}"]`;
  const pileTarget = (kind: 'tableau' | 'foundation', index: number) => {
    const pile = kind === 'tableau' ? state.tableau[index] : state.foundations[index];
    const key = topKey(pile ?? []);
    return key ? cardSel(key) : slot(kind, index);
  };

  switch (move.type) {
    case 'draw':
    case 'recycle': {
      const key = topKey(state.stock);
      await tap(page, key ? cardSel(key) : slot('stock'));
      return;
    }
    case 'waste-to-foundation':
    case 'waste-to-tableau': {
      await tap(page, cardSel(topKey(state.waste) ?? ''));
      await tap(
        page,
        move.type === 'waste-to-foundation'
          ? pileTarget('foundation', move.foundation)
          : pileTarget('tableau', move.column),
      );
      return;
    }
    case 'tableau-to-foundation': {
      await tap(page, cardSel(topKey(state.tableau[move.column] ?? []) ?? ''));
      await tap(page, pileTarget('foundation', move.foundation));
      return;
    }
    case 'tableau-to-tableau': {
      const card = state.tableau[move.from]?.[move.index];
      if (!card) throw new Error('No card to move');
      await tap(page, cardSel(cardKey(card)));
      await tap(page, pileTarget('tableau', move.to));
      return;
    }
    case 'foundation-to-tableau':
      throw new Error('The solver never moves cards off a foundation');
  }
}

test('wins a solver-found deal by tapping, and records the win', async ({ page }) => {
  test.setTimeout(240_000);
  const seed = 10;
  const start = deal(seed, 1);
  const result = solve(start, { maxNodes: 50_000 });
  if (result.status !== 'solved') throw new Error('Solver could not solve the e2e seed');

  await page.goto(`/?seed=${String(seed)}&draw=1`);
  let state = start;
  for (const move of result.moves) {
    await perform(page, state, move);
    state = applyMove(state, move);
    // Wait out the double-tap window so consecutive taps on one card stay single taps.
    await page.waitForTimeout(360);
    await expect(page.locator('[data-hud="moves"]')).toHaveText(String(state.moves));
  }

  await expect(page.getByRole('heading', { name: 'You won!' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Stats' }).click();
  await page.getByRole('radio', { name: 'Draw 1' }).click();
  const won = page.getByRole('dialog').getByText('Won', { exact: true });
  await expect(won.locator('xpath=following-sibling::dd[1]')).toHaveText('1');
});

test('protects a name with a password and logs in on another browser', async ({ browser }) => {
  const name = `E2E ${String(Date.now()).slice(-8)}`;

  const first = await browser.newPage();
  await first.goto('/');
  await first.getByRole('button', { name: 'Settings' }).click();
  await first.getByLabel('Your name').fill(name);
  await first.getByRole('button', { name: 'Save' }).click();
  await expect(first.getByText(`Welcome, ${name}!`)).toBeVisible();
  await first.getByLabel(/Password/).fill('correct horse');
  await first.getByRole('button', { name: 'Protect' }).click();
  await expect(first.getByText('Your name is protected.')).toBeVisible();

  const second = await browser.newPage();
  await second.goto('/');
  await second.getByRole('button', { name: 'Settings' }).click();
  await second.getByLabel('Your name').fill(name);
  await second.getByRole('button', { name: 'Save' }).click();
  await expect(second.getByText('This name is protected.')).toBeVisible();
  await second.getByLabel(`Log in as ${name}`).fill('wrong password');
  await second.getByRole('button', { name: 'Log in' }).click();
  await expect(second.getByText('Wrong name or password')).toBeVisible();
  await second.getByLabel(`Log in as ${name}`).fill('correct horse');
  await second.getByRole('button', { name: 'Log in' }).click();
  await expect(second.getByText(`Signed in as ${name}.`).first()).toBeVisible();
});
