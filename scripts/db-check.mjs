// فحص صحة قاعدة البيانات: المخزون، متوسط التكلفة، الأرصدة، لوحة التحكم
// الاستخدام: node scripts/db-check.mjs
import { connectDb } from './db-lib.mjs';

const client = await connectDb();

try {
  // محاكاة جلسة المالك حتى تعمل الدوال المحمية
  const { rows: owners } = await client.query(
    "select id, full_name from public.profiles where role = 'owner' order by created_at limit 1",
  );
  if (owners.length === 0) {
    console.error('✗ لا يوجد مالك — شغّل: npm run create-owner');
    process.exit(1);
  }
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: owners[0].id, role: 'authenticated' }),
  ]);
  console.log(`المالك: ${owners[0].full_name}\n`);

  const { rows: counts } = await client.query(`
    select
      (select count(*) from public.products) as products,
      (select count(*) from public.customers) as customers,
      (select count(*) from public.suppliers) as suppliers,
      (select count(*) from public.sales) as sales,
      (select count(*) from public.purchases) as purchases,
      (select count(*) from public.returns) as returns,
      (select count(*) from public.payments) as payments,
      (select count(*) from public.stock_movements) as movements,
      (select count(*) from public.cash_transactions) as cash_txs,
      (select count(*) from public.audit_logs) as audit_logs
  `);
  console.log('السجلات:', counts[0]);

  const { rows: stock } = await client.query(`
    select name, stock_units, round(avg_unit_cost, 4) as avg_cost,
      round(stock_units * avg_unit_cost, 3) as value
    from public.products order by name limit 6
  `);
  console.log('\nعينة مخزون:');
  for (const r of stock) console.log(`  ${r.name}: ${r.stock_units} حبة | متوسط تكلفة الحبة ${r.avg_cost} | قيمة ${r.value}`);

  const { rows: cust } = await client.query(
    'select name, balance from public.customers where balance <> 0 order by balance desc',
  );
  console.log('\nديون العملاء:');
  for (const r of cust) console.log(`  ${r.name}: ${r.balance} د.أ`);

  const { rows: supp } = await client.query(
    'select name, balance from public.suppliers where balance <> 0 order by balance desc',
  );
  console.log('\nديون الموردين:');
  for (const r of supp) console.log(`  ${r.name}: ${r.balance} د.أ`);

  const { rows: dash } = await client.query('select public.report_dashboard() as d');
  const d = dash[0].d;
  console.log('\nلوحة التحكم:');
  console.log(`  مبيعات اليوم: ${d.today.sales_total} د.أ (${d.today.sales_count} فاتورة) | ربح ${d.today.profit}`);
  console.log(`  قيمة المخزون: ${d.stock.value} د.أ | أصناف منخفضة: ${d.stock.low_stock_count}`);
  console.log(`  ديون العملاء: ${d.debts.customers_total} | ديون الموردين: ${d.debts.suppliers_total}`);
  console.log(`  رصيد الصندوق: ${d.cash_balance}`);

  const { rows: sums } = await client.query(`
    select s.invoice_no, s.total, s.paid, s.profit,
      (select round(sum(si.net_total), 3) from public.sale_items si where si.sale_id = s.id) as items_net,
      (select round(sum(si.profit), 3) from public.sale_items si where si.sale_id = s.id) as items_profit
    from public.sales s order by s.invoice_no
  `);
  console.log('\nتطابق مجاميع الفواتير (الفاتورة = مجموع سطورها):');
  let allOk = true;
  for (const r of sums) {
    const ok = Number(r.total) === Number(r.items_net) && Number(r.profit) === Number(r.items_profit);
    if (!ok) allOk = false;
    console.log(`  ${r.invoice_no}: total=${r.total} itemsNet=${r.items_net} profit=${r.profit} itemsProfit=${r.items_profit} ${ok ? '✓' : '✗ غير متطابق!'}`);
  }
  console.log(allOk ? '\n✓ كل المجاميع متطابقة' : '\n✗ يوجد عدم تطابق!');
} finally {
  await client.end();
}
