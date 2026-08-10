// تطبيق ملفات الـ Migrations على قاعدة البيانات (مع تتبّع ما طُبّق مسبقًا)
// الاستخدام: node scripts/db-apply.mjs
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectDb, readSql } from './db-lib.mjs';

const client = await connectDb();

try {
  await client.query(`
    create table if not exists public._migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const dir = resolve(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const { rows } = await client.query('select name from public._migrations');
  const applied = new Set(rows.map((r) => r.name));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`↷ ${file} (مطبّق مسبقًا)`);
      continue;
    }
    const sql = readSql(`supabase/migrations/${file}`);
    process.stdout.write(`→ ${file} ... `);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into public._migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log('تم ✓');
      ran += 1;
    } catch (err) {
      await client.query('rollback');
      console.error(`\n✗ فشل في ${file}:`);
      console.error(`  ${err.message}`);
      if (err.position) {
        const pos = Number(err.position);
        const context = sql.slice(Math.max(0, pos - 120), pos + 120);
        console.error(`  ...حول الموضع ${pos}:\n${context}`);
      }
      process.exit(1);
    }
  }

  console.log(ran > 0 ? `\n✓ اكتمل تطبيق ${ran} ملف` : '\n✓ قاعدة البيانات محدّثة — لا جديد');
} finally {
  await client.end();
}
