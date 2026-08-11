import { readFileSync } from 'node:fs';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

function loadEnv(path) {
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ||= value;
  }
}

if (!process.argv.includes('--confirm=RESET_ONE_CUSTOMER')) {
  console.error('Missing --confirm=RESET_ONE_CUSTOMER');
  process.exit(1);
}

loadEnv('.env.local');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is missing');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const operationalTables = [
  'public.sale_items',
  'public.return_items',
  'public.purchase_items',
  'public.inventory_count_items',
  'public.inventory_counts',
  'public.returns',
  'public.payments',
  'public.sales',
  'public.purchases',
  'public.customer_ledger',
  'public.supplier_ledger',
  'public.stock_movements',
  'public.cash_transactions',
  'public.cash_sessions',
  'public.expenses',
  'public.notes',
  'public.held_sales',
  'public.notifications',
  'public.customer_prices',
  'public.customers',
  'public.suppliers',
  'public.products',
  'public.categories',
  'public.counters',
];

await client.connect();

try {
  await client.query('begin');
  await client.query(`truncate table ${operationalTables.join(', ')} restart identity cascade`);
  await client.query(
    `
      insert into public.customers
        (name, shop_name, phone, whatsapp, area, address, notes, credit_limit, balance, is_active)
      values
        ($1, $2, null, null, null, null, $3, 0, 0, true)
    `,
    ['زبون عام', 'زبون واحد', 'عميل بداية نظيفة بدون رصيد أو حركات']
  );
  await client.query('commit');

  const { rows } = await client.query(`
    select
      (select count(*)::int from public.customers) as customers,
      (select count(*)::int from public.products) as products,
      (select count(*)::int from public.sales) as sales,
      (select count(*)::int from public.purchases) as purchases,
      (select count(*)::int from public.suppliers) as suppliers,
      (select coalesce(sum(balance), 0)::numeric from public.customers) as customer_balance
  `);
  console.log(JSON.stringify(rows[0], null, 2));
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
