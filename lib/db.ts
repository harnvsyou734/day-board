import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Neon over HTTP: one round trip per query and no pool to keep warm, which is
// what a serverless function wants. Use the pooled connection string.
//
// Resolved lazily and cached. Reading the env var at module scope would turn a
// missing DATABASE_URL into a *build* failure -- Next imports every route
// module while building -- instead of a handled 500 at request time.

let client: NeonQueryFunction<false, false> | null = null;

function connection(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  client = neon(url);
  return client;
}

/**
 * Tagged-template query, same shape as neon's own:
 *   await sql`select * from tasks where id = ${id}::uuid`
 *
 * Values are always sent as bound parameters, never interpolated into the SQL
 * text, so a task's text cannot alter the statement.
 */
export function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  return connection()(strings, ...values) as Promise<T[]>;
}
