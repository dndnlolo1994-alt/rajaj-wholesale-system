// تشغيل البيانات التجريبية (supabase/seed.sql) — يرفض التكرار إن وُجدت مبيعات
// الاستخدام: node scripts/db-seed.mjs [--force]
import { connectDb, readSql } from './db-lib.mjs';

const force = process.argv.includes('--force');
const client = await connectDb();

try {
  const { rows } = await client.query('select count(*)::int as n from public.sales');
  if (rows[0].n > 0 && !force) {
    console.log(`⚠ توجد ${rows[0].n} فاتورة في قاعدة البيانات — تخطّي البيانات التجريبية.`);
    console.log('  لإجبار التشغيل: node scripts/db-seed.mjs --force');
    process.exit(0);
  }

  const sql = readSql('supabase/seed.sql');
  console.log('→ تشغيل البيانات التجريبية ...');
  await client.query(sql);
  console.log('✓ تم إدخال البيانات التجريبية بنجاح');
} catch (err) {
  console.error('✗ فشل تشغيل البيانات التجريبية:');
  console.error(`  ${err.message}`);
  if (err.where) console.error(`  ${err.where}`);
  process.exit(1);
} finally {
  await client.end();
}
