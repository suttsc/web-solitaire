import type { DrawModeValue, LeaderboardMetric } from '../../shared/schema';
import { PlayerNameSchema } from '../../shared/schema';
import { computeStats } from '../../shared/stats';
import type { Api } from '../data/api';
import type { LocalGame } from '../data/db';
import { showDialog, statList } from './dialog';
import { formatDuration, formatNumber } from './format';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A row of toggle buttons; calls `onChange` with the picked value. */
export function segmented<T extends string | number>(
  options: readonly (readonly [T, string])[],
  value: T,
  onChange: (value: T) => void,
): HTMLElement {
  const group = el('div', 'flex gap-1 rounded-xl bg-black/20 p-1');
  group.setAttribute('role', 'radiogroup');
  for (const [option, label] of options) {
    const button = el(
      'button',
      'min-h-9 flex-1 rounded-lg px-3 text-sm font-medium transition aria-checked:bg-white aria-checked:text-felt-dark',
      label,
    );
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(option === value));
    button.addEventListener('click', () => {
      onChange(option);
    });
    group.append(button);
  }
  return group;
}

const DRAW_OPTIONS = [
  [3, 'Draw 3'],
  [1, 'Draw 1'],
] as const;

const orDash = (value: number | null, format: (v: number) => string): string =>
  value === null ? '—' : format(value);

/** Personal stats (from this device, including pulled history) plus global stats from the server. */
const RESULT_LABELS = { won: 'Won', stuck: 'Stuck', abandoned: 'Abandoned' } as const;

function recentGames(
  games: readonly LocalGame[],
  draw: DrawModeValue,
  onReplay: (game: LocalGame) => void,
): HTMLElement {
  const recent = games
    .filter((game) => game.drawMode === draw)
    .slice(-8)
    .reverse();
  if (recent.length === 0) return el('p', 'text-white/60', 'No games yet.');

  const list = el('ul', 'space-y-1');
  for (const game of recent) {
    const row = el(
      'li',
      'grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-black/15 px-3 py-2',
    );
    const info = el('div', 'min-w-0');
    info.append(
      el(
        'div',
        'font-medium text-white',
        `${RESULT_LABELS[game.result]} · ${formatDuration(game.durationMs)} · ${formatNumber(game.moves)} ${game.moves === 1 ? 'move' : 'moves'}`,
      ),
      el(
        'div',
        'text-xs text-white/60',
        `${new Date(game.endedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · deal #${String(game.seed)}${game.scoringMode === 'vegas' ? ' · Vegas' : ''}`,
      ),
    );
    const again = el(
      'button',
      'min-h-9 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20',
      'Play again',
    );
    again.type = 'button';
    again.addEventListener('click', () => {
      again.closest('dialog')?.close();
      onReplay(game);
    });
    row.append(info, again);
    list.append(row);
  }
  return list;
}

export async function showStats(
  games: readonly LocalGame[],
  api: Api,
  initialDraw: DrawModeValue,
  onReplay: (game: LocalGame) => void,
): Promise<void> {
  const body = el('div', 'space-y-4');
  let draw = initialDraw;

  const render = () => {
    const stats = computeStats(games, draw);
    const global = el('div', 'text-white/60', 'Loading…');
    body.replaceChildren(
      segmented(DRAW_OPTIONS, draw, (value) => {
        draw = value;
        render();
      }),
      el('h3', 'font-semibold text-white', 'You'),
      statList([
        ['Played', formatNumber(stats.played)],
        ['Won', formatNumber(stats.won)],
        ['Win rate', `${String(Math.round(stats.winRate * 100))}%`],
        ['Best time', orDash(stats.bestTimeMs, formatDuration)],
        ['Fewest moves', orDash(stats.fewestMoves, formatNumber)],
        ['Best score', orDash(stats.bestScore, formatNumber)],
        ['Current streak', formatNumber(stats.currentStreak)],
        ['Longest streak', formatNumber(stats.longestStreak)],
      ]),
      el('h3', 'font-semibold text-white', 'Everyone'),
      global,
      el('h3', 'font-semibold text-white', 'Recent games'),
      recentGames(games, draw, onReplay),
    );

    const requested = draw;
    api.globalStats(requested).then(
      (result) => {
        if (requested !== draw) return;
        global.replaceWith(
          statList([
            ['Players', formatNumber(result.players)],
            ['Games played', formatNumber(result.played)],
            ['Games won', formatNumber(result.won)],
            ['Best time', orDash(result.bestTimeMs, formatDuration)],
            ['Average winning time', orDash(result.averageWinMs, formatDuration)],
          ]),
        );
      },
      () => {
        global.textContent = 'Global stats need a connection.';
      },
    );
  };

  render();
  await showDialog({
    title: 'Stats',
    body,
    actions: [{ label: 'Close', value: null }],
    dismissValue: null,
  });
}

const METRICS: Record<LeaderboardMetric, { label: string; format: (v: number) => string }> = {
  time: { label: 'Best time', format: formatDuration },
  score: { label: 'Best score', format: formatNumber },
  moves: { label: 'Fewest moves', format: formatNumber },
};

/** Global leaderboard: wins only, each player's best once, per draw mode. */
export async function showLeaderboard(
  api: Api,
  initialDraw: DrawModeValue,
  myName: string | null,
): Promise<void> {
  const body = el('div', 'space-y-3');
  let draw = initialDraw;
  let by: LeaderboardMetric = 'time';

  const render = () => {
    const list = el('ol', 'space-y-1');
    list.append(el('li', 'text-white/60', 'Loading…'));
    body.replaceChildren(
      segmented(DRAW_OPTIONS, draw, (value) => {
        draw = value;
        render();
      }),
      segmented(
        (Object.keys(METRICS) as LeaderboardMetric[]).map((m) => [m, METRICS[m].label] as const),
        by,
        (value) => {
          by = value;
          render();
        },
      ),
      list,
    );

    const requested = { draw, by };
    api.leaderboard(draw, by).then(
      ({ entries }) => {
        if (requested.draw !== draw || requested.by !== by) return;
        list.replaceChildren();
        if (entries.length === 0) list.append(el('li', 'text-white/60', 'No wins yet.'));
        entries.forEach((entry, i) => {
          const mine = myName !== null && entry.name.toLowerCase() === myName.toLowerCase();
          const row = el(
            'li',
            `grid grid-cols-[2rem_1fr_auto] items-center rounded-lg px-2 py-1.5 ${mine ? 'bg-amber-300/20 text-white' : ''}`,
          );
          row.append(
            el('span', 'tabular-nums text-white/60', String(i + 1)),
            el('span', 'truncate font-medium text-white', entry.name),
            el('span', 'font-semibold tabular-nums text-white', METRICS[by].format(entry.value)),
          );
          list.append(row);
        });
      },
      () => {
        list.replaceChildren(el('li', 'text-white/60', 'The leaderboard needs a connection.'));
      },
    );
  };

  render();
  await showDialog({
    title: 'Leaderboard',
    body,
    actions: [{ label: 'Close', value: null }],
    dismissValue: null,
  });
}

export interface NameFieldOptions {
  readonly current: string | null;
  readonly link: (name: string) => Promise<string>;
}

/** Name entry that links this browser to a player (and pulls their history). */
export function nameField({ current, link }: NameFieldOptions): HTMLElement {
  const form = el('form', 'space-y-2');
  const label = el('label', 'block text-sm font-medium text-white', 'Your name');
  const row = el('div', 'flex gap-2');
  const input = el(
    'input',
    'min-h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-black/20 px-3 text-white placeholder:text-white/40',
  );
  input.name = 'name';
  input.autocomplete = 'username';
  input.placeholder = 'Shown on the leaderboard';
  input.value = current ?? '';
  label.htmlFor = input.id = 'player-name';
  const save = el(
    'button',
    'min-h-11 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-stone-900',
    'Save',
  );
  save.type = 'submit';
  const message = el(
    'p',
    'text-xs text-white/60',
    current
      ? `Playing as ${current}. Your games sync to this name.`
      : 'Add a name to sync your games and join the leaderboard.',
  );
  row.append(input, save);
  form.append(label, row, message);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const parsed = PlayerNameSchema.safeParse(input.value);
    if (!parsed.success) {
      message.textContent = parsed.error.issues[0]?.message ?? 'Invalid name';
      return;
    }
    save.disabled = true;
    message.textContent = 'Linking…';
    link(parsed.data)
      .then(
        (text) => {
          message.textContent = text;
        },
        () => {
          message.textContent = "Couldn't reach the server. Try again when you're online.";
        },
      )
      .finally(() => {
        save.disabled = false;
      });
  });

  return form;
}

export function toggleRow(
  labelText: string,
  hint: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const label = el('label', 'flex items-center justify-between gap-4');
  const text = el('span', 'space-y-0.5');
  text.append(
    el('span', 'block font-medium text-white', labelText),
    el('span', 'block text-xs text-white/60', hint),
  );
  const input = el('input', 'size-5 accent-amber-400');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => {
    onChange(input.checked);
  });
  label.append(text, input);
  return label;
}

export function actionButton(text: string, onClick: () => void): HTMLButtonElement {
  const button = el(
    'button',
    'min-h-11 w-full rounded-xl bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20',
    text,
  );
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

export { el };
