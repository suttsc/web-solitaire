import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/**
 * Just enough of D1's API over Node's built-in SQLite to run the real
 * migrations and repository queries in Vitest without workerd.
 */
class Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SQLInputValue[] = [],
  ) {}

  bind(...params: unknown[]): Statement {
    return new Statement(this.db, this.sql, params as SQLInputValue[]);
  }

  first(): Promise<unknown> {
    return Promise.resolve(this.db.prepare(this.sql).get(...this.params) ?? null);
  }

  all(): Promise<{ results: unknown[] }> {
    return Promise.resolve({ results: this.db.prepare(this.sql).all(...this.params) });
  }

  run(): Promise<{ meta: { changes: number } }> {
    const { changes } = this.db.prepare(this.sql).run(...this.params);
    return Promise.resolve({ meta: { changes: Number(changes) } });
  }
}

export function createTestD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  const dir = join(import.meta.dirname, '../../migrations');
  for (const file of readdirSync(dir).sort()) db.exec(readFileSync(join(dir, file), 'utf8'));

  const d1 = {
    prepare: (sql: string) => new Statement(db, sql),
    async batch(statements: Statement[]) {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return d1 as unknown as D1Database;
}
