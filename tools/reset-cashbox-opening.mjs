import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Client } = pg;

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
  await client.query(`
    update public.app_settings
    set value = jsonb_set(coalesce(value, '{}'::jsonb), '{opening_balance}', '0'::jsonb, true),
        updated_at = now()
    where key = 'cashbox'
  `);
  const { rows } = await client.query(`
    select value from public.app_settings where key = 'cashbox'
  `);
  console.log(JSON.stringify(rows[0], null, 2));
} finally {
  await client.end();
}
