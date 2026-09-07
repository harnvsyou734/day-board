/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 *   npm run db:setup
 *
 * Safe to run more than once -- every statement in the schema is
 * `create ... if not exists`, so a second run changes nothing.
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

// A minimal .env.local reader. Deliberately not `source`d from the shell:
// connection strings and iCal URLs are full of characters a shell will try
// to interpret, and a stray leading space silently turns the assignment into
// a command.
function loadEnv(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv('.env.local');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Fill it in .env.local (see .env.example).');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Strip comment lines, then split on statement terminators.
const statements = readFileSync('db/schema.sql', 'utf8')
  .split(/;\s*(?:\r?\n|$)/)
  .map((chunk) =>
    chunk
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim(),
  )
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log('  applied:', statement.split('\n')[0].slice(0, 64));
}

const tables = await sql.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`,
);
console.log('\ntables:', tables.map((r) => r.table_name).join(', '));
