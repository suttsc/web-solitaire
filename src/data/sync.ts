import type { GameRecord, Player } from '../../shared/schema';

/** The linked player, plus a session token when the name is password-protected. */
export interface SyncPlayer extends Player {
  readonly token: string | null;
}
import type { Api } from './api';
import type { Persistence } from './persistence';

const BATCH_SIZE = 50;

/** Strip local-only fields before upload. */
const toRecord = ({
  syncedAt: _syncedAt,
  ...record
}: GameRecord & { syncedAt: unknown }): GameRecord => record;

/**
 * Uploads finished games that the server doesn't have yet. Safe to call as often as you like:
 * concurrent calls share one run, and uploads are idempotent on the server.
 */
export function createSync(
  api: Api,
  persistence: Persistence,
  getPlayer: () => SyncPlayer | null,
  now: () => Date = () => new Date(),
) {
  let running: Promise<number> | null = null;

  async function run(): Promise<number> {
    const player = getPlayer();
    if (!player) return 0;

    const pending = await persistence.unsyncedGames();
    let uploaded = 0;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE).map(toRecord);
      const { stored } = await api.uploadGames(player.id, batch, player.token);
      await persistence.markSynced(stored, now().toISOString());
      uploaded += stored.length;
    }
    return uploaded;
  }

  return {
    /** Upload what's pending. Resolves to the number of games stored; network errors are left for the next try. */
    flush(): Promise<number> {
      running ??= run()
        .catch(() => 0)
        .finally(() => {
          running = null;
        });
      return running;
    },

    /** Link this browser to a name (creating the player if new) and pull that player's history. */
    async link(name: string): Promise<{ player: Player; created: boolean }> {
      const result = await api.linkPlayer(name);
      if (!result.created) await this.pullHistory(result.player.name);
      return result;
    },

    /** Log in to a password-protected name and pull its history. */
    async login(name: string, password: string): Promise<{ player: Player; token: string }> {
      const result = await api.login(name, password);
      await this.pullHistory(result.player.name);
      return result;
    },

    async pullHistory(name: string): Promise<void> {
      const { games } = await api.playerGames(name);
      await persistence.importGames(games, now().toISOString());
    },
  };
}

export type Sync = ReturnType<typeof createSync>;
