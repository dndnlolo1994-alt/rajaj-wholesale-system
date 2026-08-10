// نسخة احتياطية محلية: يصدّر كل الجداول إلى ملف JSON في مجلد backups/
// الاستخدام: npm run backup:local
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectDb } from './db-lib.mjs';

const TABLES = [
  'profiles', 'app_settings', 'counters', 'categories', 'products',
  'customers', 'suppliers', 'customer_prices',
  'sales', 'sale_items', 'held_sales', 'purchases', 'purchase_items',
  'payments', 'customer_ledger', 'supplier_ledger', 'stock_movements',
  'returns', 'return_items', 'expense_categories', 'expenses',
  'cash_transactions', 'cash_sessions', 'inventory_counts', 'inventory_count_items',
  'notes', 'notifications', 'audit_logs', 'backup_logs',
];

const client = await connectDb();
try {
  const tables = {};
  let rowsCount = 0;
  for (const table of TABLES) {
    const { rows } = await client.query(`select * from public.${table}`);
    tables[table] = rows;
    rowsCount += rows.length;
    console.log(`  ${table}: ${rows.length}`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = resolve(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `rajaei-backup-${stamp}.json`);
  writeFileSync(
    file,
    JSON.stringify({ system: 'rajaei-wholesale-system', version: 1, exported_at: new Date().toISOString(), rows_count: rowsCount, tables }),
    'utf8',
  );
  await client.query(
    `insert into public.backup_logs (backup_type, status, file_name, tables_count, rows_count, finished_at) values ('manual','success',$1,$2,$3, now())`,
    [`rajaei-backup-${stamp}.json`, TABLES.length, rowsCount],
  );
  console.log(`\n✓ النسخة الاحتياطية: ${file} (${rowsCount} سجل)`);
} finally {
  await client.end();
}
