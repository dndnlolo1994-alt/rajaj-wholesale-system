import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Client } = pg;

if (!process.argv.includes('--confirm=RESET_AUDIT')) {
  console.error('Missing --confirm=RESET_AUDIT');
  process.exit(1);
}

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  const key = match[1].trim();
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] ||= value;
}

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query('truncate table public.audit_logs');
  const { rows } = await client.query('select count(*)::int as audit_logs from public.audit_logs');
  console.log(JSON.stringify(rows[0], null, 2));
} finally {
  await client.end();
}
