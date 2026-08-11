import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type DbHarness, OWNER_ID, SALES_ID } from './harness';

// اختبارات تكامل مالية على PostgreSQL حقيقي بنفس Migrations الإنتاج:
// الشراء، البيع بالكرتونة والحبة، الخصومات وتوزيعها، متوسط التكلفة المرجّح،
// الدين والدفع، المرتجع السليم والتالف، الإلغاء، الجرد، إغلاق الصندوق، الصلاحيات.

const n = (v: unknown) => Number(v);

let h: DbHarness;
let categoryId: string;
let productA: string; // شيبس — كرتونة 24 حبة
let productB: string; // عصير — كرتونة 12 حبة
let supplierId: string;
let customerId: string;
let sale1: Record<string, unknown>;
let sale1Id: string;

beforeAll(async () => {
  h = await startHarness();

  const cat = await h.one<{ id: string }>(`insert into categories (name) values ('شيبس ومقرمشات') returning id`);
  categoryId = cat.id;
  const a = await h.one<{ id: string }>(
    `insert into products (name, barcode, category_id, units_per_carton, sale_price_carton, sale_price_piece, min_stock_units)
     values ('شيبس كتشب', '6251000000011', $1, 24, 10.000, 0.500, 24) returning id`,
    [categoryId],
  );
  productA = a.id;
  const b = await h.one<{ id: string }>(
    `insert into products (name, barcode, category_id, units_per_carton, sale_price_carton, sale_price_piece)
     values ('عصير برتقال', '6251000000028', $1, 12, 6.000, 0.550) returning id`,
    [categoryId],
  );
  productB = b.id;
  const s = await h.one<{ id: string }>(`insert into suppliers (name, company_name) values ('أبو خالد', 'المنار للتوزيع') returning id`);
  supplierId = s.id;
  const c = await h.one<{ id: string }>(`insert into customers (name, shop_name) values ('أبو أحمد', 'محل النور') returning id`);
  customerId = c.id;
}, 300_000);

afterAll(async () => {
  await h?.stop();
});

describe('المشتريات ومتوسط التكلفة المرجّح', () => {
  it('شراء أول يرفع المخزون ويضبط التكلفة وحساب المورد', async () => {
    const res = await h.rpc('create_purchase', {
      p: {
        supplier_id: supplierId,
        paid: 50,
        payment_method: 'cash',
        items: [
          { product_id: productA, unit: 'carton', qty: 10, unit_cost: 7.2 },
          { product_id: productB, unit: 'carton', qty: 5, unit_cost: 4.8 },
        ],
      },
    });
    expect(n(res.total)).toBe(96);
    expect(n(res.remaining)).toBe(46);
    expect(n(res.supplier_balance)).toBe(46);
    expect(String(res.invoice_no)).toMatch(/^PUR-\d{4}-000001$/);

    const pa = await h.one(`select stock_units, avg_unit_cost from products where id = $1`, [productA]);
    expect(n(pa.stock_units)).toBe(240);
    expect(n(pa.avg_unit_cost)).toBeCloseTo(0.3, 6);

    const moves = await h.q(`select move_type, qty_change, balance_after from stock_movements where product_id = $1 order by id`, [productA]);
    expect(moves).toHaveLength(1);
    expect(moves[0].move_type).toBe('purchase');
    expect(n(moves[0].qty_change)).toBe(240);
    expect(n(moves[0].balance_after)).toBe(240);

    const cash = await h.one(`select tx_type, direction, amount from cash_transactions order by id desc limit 1`);
    expect(cash.tx_type).toBe('supplier_payment');
    expect(cash.direction).toBe('out');
    expect(n(cash.amount)).toBe(50);
  });

  it('شراء ثانٍ بسعر أعلى يعدّل المتوسط المرجّح دون المساس بالتاريخ', async () => {
    await h.rpc('create_purchase', {
      p: {
        supplier_id: supplierId,
        paid: 0,
        items: [{ product_id: productA, unit: 'carton', qty: 10, unit_cost: 8.4 }],
      },
    });
    const pa = await h.one(`select stock_units, avg_unit_cost, purchase_price_carton from products where id = $1`, [productA]);
    expect(n(pa.stock_units)).toBe(480);
    expect(n(pa.avg_unit_cost)).toBeCloseTo(0.325, 6); // (240×0.30 + 240×0.35) / 480
    expect(n(pa.purchase_price_carton)).toBe(8.4);

    const sup = await h.one(`select balance from suppliers where id = $1`, [supplierId]);
    expect(n(sup.balance)).toBe(130);
  });
});

describe('البيع: وحدات مزدوجة، خصومات، تكلفة مجمّدة، دين', () => {
  it('فاتورة بيع كاملة بدقة الفلس', async () => {
    sale1 = await h.rpc('create_sale', {
      p: {
        customer_id: customerId,
        paid: 10,
        payment_method: 'cash',
        invoice_discount: 1.0,
        items: [
          { product_id: productA, unit: 'carton', qty: 2, unit_price: 10, discount: 0.5 },
          { product_id: productA, unit: 'piece', qty: 5, unit_price: 0.5 },
          { product_id: productB, unit: 'carton', qty: 1, unit_price: 6 },
        ],
      },
    });
    sale1Id = String(sale1.id);
    expect(String(sale1.invoice_no)).toMatch(/^RM-\d{4}-000001$/);
    expect(n(sale1.total)).toBe(27); // 28.5 − 0.5 − 1.0
    expect(n(sale1.paid)).toBe(10);
    expect(n(sale1.remaining)).toBe(17);
    expect(n(sale1.customer_balance)).toBe(17);
    // التكلفة: 53 حبة A ×0.325 + 12 حبة B ×0.4 = 17.225 + 4.8
    expect(n(sale1.profit)).toBeCloseTo(27 - 22.025, 3);

    const sale = await h.one(`select * from sales where id = $1`, [sale1Id]);
    expect(n(sale.subtotal)).toBe(28.5);
    expect(n(sale.line_discount_total)).toBe(0.5);
    expect(n(sale.invoice_discount)).toBe(1);
    expect(n(sale.cost_total)).toBeCloseTo(22.025, 3);

    // توزيع خصم الفاتورة مضبوط: مجموع صوافي السطور = الإجمالي، ومجموع أرباحها = الربح
    const sums = await h.one(
      `select sum(net_total) as net, sum(profit) as profit, sum(inv_discount_share) as shares from sale_items where sale_id = $1`,
      [sale1Id],
    );
    expect(n(sums.net)).toBe(27);
    expect(n(sums.shares)).toBe(1);
    expect(n(sums.profit)).toBeCloseTo(n(sale.profit), 3);

    const pa = await h.one(`select stock_units from products where id = $1`, [productA]);
    expect(n(pa.stock_units)).toBe(427); // 480 − 48 − 5

    const ledger = await h.q(`select entry_type, debit, credit, balance_after from customer_ledger where customer_id = $1 order by id`, [customerId]);
    expect(ledger).toHaveLength(2);
    expect(ledger[0].entry_type).toBe('sale');
    expect(n(ledger[0].debit)).toBe(27);
    expect(n(ledger[1].credit)).toBe(10);
    expect(n(ledger[1].balance_after)).toBe(17);

    const pay = await h.one(`select payment_no, amount, direction from payments where sale_id = $1`, [sale1Id]);
    expect(String(pay.payment_no)).toMatch(/^RCV-/);
    expect(n(pay.amount)).toBe(10);
    expect(pay.direction).toBe('in');
  });

  it('يمنع البيع فوق المخزون ويمنع الذمم بدون اسم عميل', async () => {
    await h.rpcFail(
      'create_sale',
      { p: { customer_id: customerId, paid: 0, items: [{ product_id: productA, unit: 'carton', qty: 100, unit_price: 10 }] } },
      'INSUFFICIENT_STOCK',
    );
    await h.rpcFail(
      'create_sale',
      { p: { paid: 5, items: [{ product_id: productA, unit: 'carton', qty: 1, unit_price: 10 }] } },
      'CASH_SALE_NEEDS_NAME',
    );
  });

  it('البيع بذمم لزبون بلا حساب يفتح له حسابًا ويعيد استخدامه', async () => {
    // صنف خاص بهذا الاختبار حتى لا يتأثر مخزون بقية الاختبارات
    const p = await h.one<{ id: string }>(
      `insert into products (name, category_id, units_per_carton, sale_price_carton, sale_price_piece)
       values ('بسكويت اختبار الذمم', $1, 10, 10.000, 1.000) returning id`,
      [categoryId],
    );
    await h.rpc('create_purchase', {
      p: {
        supplier_id: supplierId,
        paid: 0,
        items: [{ product_id: p.id, unit: 'carton', qty: 5, unit_cost: 6 }],
      },
    });

    const line = { product_id: p.id, unit: 'carton', qty: 1, unit_price: 10 };

    const first = await h.rpc('create_sale', { p: { paid: 0, cash_customer_name: 'أبو زياد', items: [line] } });
    expect(first.auto_customer).toBe(true);
    expect(first.customer_name).toBe('أبو زياد');
    expect(n(first.remaining)).toBe(10);

    // الدين انسجّل على حساب فعلي، مش على فاتورة سايبة بلا صاحب
    const sale1 = await h.one(`select customer_id, cash_customer_name from sales where id = $1`, [first.id]);
    expect(sale1.customer_id).toBe(first.customer_id);
    expect(sale1.cash_customer_name).toBeNull();

    // نفس الاسم (مع فراغات) لازم يرجع لنفس الحساب ويراكم الرصيد
    const second = await h.rpc('create_sale', {
      p: { paid: 4, payment_method: 'cash', cash_customer_name: '  أبو زياد  ', items: [line] },
    });
    expect(second.auto_customer).toBe(false);
    expect(second.customer_id).toBe(first.customer_id);
    expect(n(second.customer_balance)).toBe(16); // 10 + (10 − 4)

    // المدفوع بالكامل يضل بيع نقدي بدون فتح حساب
    const cash = await h.rpc('create_sale', {
      p: { paid: 10, payment_method: 'cash', cash_customer_name: 'زبون مارّ', items: [line] },
    });
    const sale3 = await h.one(`select customer_id, cash_customer_name from sales where id = $1`, [cash.id]);
    expect(sale3.customer_id).toBeNull();
    expect(sale3.cash_customer_name).toBe('زبون مارّ');
    const passing = await h.q(`select id from customers where name = 'زبون مارّ'`);
    expect(passing).toHaveLength(0);

    // تنظيف: نوقف الصنف حتى لا يدخل في جلسات الجرد اللاحقة
    await h.q(`update products set is_active = false where id = $1`, [p.id]);
  });

  it('إعداد المخزون السالب يسمح بالبيع تحت الصفر ثم الإلغاء يعيده', async () => {
    await h.q(`update app_settings set value = jsonb_set(value, '{allow_negative_stock}', 'true') where key = 'inventory'`);
    const res = await h.rpc('create_sale', {
      p: { customer_id: customerId, paid: 0, items: [{ product_id: productB, unit: 'carton', qty: 10, unit_price: 6 }] },
    });
    const pb1 = await h.one(`select stock_units from products where id = $1`, [productB]);
    expect(n(pb1.stock_units)).toBe(-72); // 48 − 120

    await h.rpc('void_sale', { p_sale_id: res.id, p_reason: 'اختبار إلغاء' });
    const pb2 = await h.one(`select stock_units from products where id = $1`, [productB]);
    expect(n(pb2.stock_units)).toBe(48);
    const voided = await h.one(`select status, void_reason from sales where id = $1`, [res.id]);
    expect(voided.status).toBe('void');
    await h.q(`update app_settings set value = jsonb_set(value, '{allow_negative_stock}', 'false') where key = 'inventory'`);

    // رصيد العميل عاد 17 (فاتورة 60 آجلة أُلغيت)
    const cust = await h.one(`select balance from customers where id = $1`, [customerId]);
    expect(n(cust.balance)).toBe(17);
  });

  it('الحد الائتماني: يمنع ثم يسمح مع الموافقة الصريحة', async () => {
    await h.q(`update customers set credit_limit = 20 where id = $1`, [customerId]);
    const payload = { customer_id: customerId, paid: 0, items: [{ product_id: productA, unit: 'carton', qty: 1, unit_price: 10 }] };
    await h.rpcFail('create_sale', { p: payload }, 'OVER_CREDIT_LIMIT');

    const res = await h.rpc('create_sale', { p: { ...payload, allow_over_credit: true } });
    expect((res.warnings as unknown[]).length).toBeGreaterThan(0);
    expect(n(res.customer_balance)).toBe(27);

    await h.rpc('void_sale', { p_sale_id: res.id, p_reason: 'تنظيف الاختبار' });
    await h.q(`update customers set credit_limit = null where id = $1`, [customerId]);
    const cust = await h.one(`select balance from customers where id = $1`, [customerId]);
    expect(n(cust.balance)).toBe(17);
  });
});

describe('الدفعات', () => {
  it('دفعة عامة ودفعة مرتبطة بفاتورة وإلغاؤها', async () => {
    const p1 = await h.rpc('record_customer_payment', { p: { customer_id: customerId, amount: 7, method: 'cash' } });
    expect(n(p1.customer_balance)).toBe(10);

    await h.rpcFail(
      'record_customer_payment',
      { p: { customer_id: customerId, amount: 20, method: 'cash', sale_id: sale1Id } },
      'EXCEEDS_SALE_REMAINING',
    );

    const p2 = await h.rpc('record_customer_payment', { p: { customer_id: customerId, amount: 17, method: 'cash', sale_id: sale1Id } });
    expect(n(p2.customer_balance)).toBeCloseTo(-7, 3);
    const saleAfter = await h.one(`select paid, remaining from sales where id = $1`, [sale1Id]);
    expect(n(saleAfter.paid)).toBe(27);
    expect(n(saleAfter.remaining)).toBe(0);

    await h.rpc('void_payment', { p_payment_id: p2.id, p_reason: 'خطأ إدخال' });
    const saleAfterVoid = await h.one(`select paid from sales where id = $1`, [sale1Id]);
    expect(n(saleAfterVoid.paid)).toBe(10);
    const cust = await h.one(`select balance from customers where id = $1`, [customerId]);
    expect(n(cust.balance)).toBe(10);
  });
});

describe('المرتجعات', () => {
  let cartonItemId: string;
  let pieceItemId: string;

  it('مرتجع سليم يعود للمخزون بتكلفته التاريخية ويعدّل الرصيد والربح', async () => {
    const items = await h.q<{ id: string; unit: string }>(`select id, unit from sale_items where sale_id = $1 order by created_at`, [sale1Id]);
    cartonItemId = items.find((i) => i.unit === 'carton')!.id;
    pieceItemId = items.find((i) => i.unit === 'piece')!.id;

    const res = await h.rpc('create_return', {
      p: {
        sale_id: sale1Id,
        reason: 'قرب انتهاء الصلاحية',
        refund_cash: 0,
        items: [{ sale_item_id: cartonItemId, unit: 'carton', qty: 1, condition: 'good' }],
      },
    });
    expect(String(res.return_no)).toMatch(/^RET-/);
    // صافي سطر الكرتونتين = 18.803 → سعر الكرتونة 9.402 (نصف الصافي مقربًا)
    expect(n(res.total)).toBeCloseTo(9.402, 3);
    expect(n(res.credited)).toBeCloseTo(9.402, 3);
    expect(n(res.customer_balance)).toBeCloseTo(0.598, 3);

    const ret = await h.one(`select restocked_cost_total, profit_delta from returns where id = $1`, [res.id]);
    expect(n(ret.restocked_cost_total)).toBeCloseTo(7.8, 3); // 24 × 0.325 تكلفة مجمّدة
    expect(n(ret.profit_delta)).toBeCloseTo(7.8 - 9.402, 3);

    const pa = await h.one(`select stock_units, avg_unit_cost from products where id = $1`, [productA]);
    expect(n(pa.stock_units)).toBe(451); // 427 بعد البيع + 24 مرتجع (الفواتير الملغاة أعادت ما خصمته)
    expect(n(pa.avg_unit_cost)).toBeCloseTo(0.325, 6);
  });

  it('يمنع إرجاع أكثر من المباع', async () => {
    await h.rpcFail(
      'create_return',
      { p: { sale_id: sale1Id, items: [{ sale_item_id: cartonItemId, unit: 'carton', qty: 2, condition: 'good' }] } },
      'RETURN_EXCEEDS_SOLD',
    );
  });

  it('مرتجع تالف: خسارة كاملة بلا رجوع للمخزون مع رد نقدي', async () => {
    const before = await h.one(`select stock_units from products where id = $1`, [productA]);
    const res = await h.rpc('create_return', {
      p: {
        sale_id: sale1Id,
        reason: 'تالف',
        refund_cash: 1.5,
        refund_method: 'cash',
        items: [{ sale_item_id: pieceItemId, unit: 'piece', qty: 3, unit_price: 0.5, condition: 'damaged' }],
      },
    });
    expect(n(res.total)).toBe(1.5);
    expect(n(res.refund_cash)).toBe(1.5);
    expect(n(res.credited)).toBe(0);

    const ret = await h.one(`select profit_delta, restocked_cost_total from returns where id = $1`, [res.id]);
    expect(n(ret.profit_delta)).toBe(-1.5);
    expect(n(ret.restocked_cost_total)).toBe(0);

    const after = await h.one(`select stock_units from products where id = $1`, [productA]);
    expect(n(after.stock_units)).toBe(n(before.stock_units)); // لا تغيير

    const cash = await h.one(`select tx_type, direction, amount from cash_transactions order by id desc limit 1`);
    expect(cash.tx_type).toBe('refund');
    expect(cash.direction).toBe('out');
    expect(n(cash.amount)).toBe(1.5);
  });
});

describe('تعديل المخزون والجرد', () => {
  it('تعديل يدوي بسبب إلزامي', async () => {
    await h.rpcFail('adjust_stock', { p: { product_id: productA, mode: 'delta', qty_units: -7, reason: '' } }, 'REASON_REQUIRED');
    const before = await h.one(`select stock_units from products where id = $1`, [productA]);
    const res = await h.rpc('adjust_stock', { p: { product_id: productA, mode: 'delta', qty_units: -7, reason: 'كسر أثناء التحميل' } });
    expect(n(res.stock_units)).toBe(n(before.stock_units) - 7);
    const move = await h.one(`select move_type, qty_change from stock_movements where product_id = $1 order by id desc limit 1`, [productA]);
    expect(move.move_type).toBe('adjustment');
    expect(n(move.qty_change)).toBe(-7);
  });

  it('جلسة جرد كاملة: عدّ، فروقات، اعتماد وتسوية', async () => {
    const start = await h.rpc('start_inventory_count', { p: { count_type: 'manual' } });
    const countId = String(start.id);
    expect(n(start.items_total)).toBe(2);

    // لا يمكن فتح جلسة ثانية
    await h.rpcFail('start_inventory_count', { p: { count_type: 'daily' } }, 'COUNT_OPEN_EXISTS');

    const liveA = n((await h.one(`select stock_units from products where id = $1`, [productA])).stock_units);
    const liveB = n((await h.one(`select stock_units from products where id = $1`, [productB])).stock_units);

    await h.rpc('set_count_item', { p_count_id: countId, p_product_id: productA, p_actual: liveA - 4 });
    await h.rpc('set_count_item', { p_count_id: countId, p_product_id: productB, p_actual: liveB });

    const done = await h.rpc('complete_inventory_count', { p_count_id: countId, p_apply: true });
    expect(n(done.total_diff_units)).toBe(-4);
    expect(n(done.adjusted_products)).toBe(1);

    const pa = await h.one(`select stock_units from products where id = $1`, [productA]);
    expect(n(pa.stock_units)).toBe(liveA - 4);

    const move = await h.one(`select move_type, qty_change from stock_movements where product_id = $1 order by id desc limit 1`, [productA]);
    expect(move.move_type).toBe('count_adjustment');
    expect(n(move.qty_change)).toBe(-4);

    const notif = await h.q(`select 1 from notifications where type = 'count_diff'`);
    expect(notif.length).toBeGreaterThan(0);
  });
});

describe('WAC عند العودة من الصفر', () => {
  it('بيع كل المخزون ثم شراء بتكلفة جديدة → المتوسط = التكلفة الجديدة تمامًا', async () => {
    await h.rpc('create_sale', {
      p: { paid: 24, payment_method: 'cash', items: [{ product_id: productB, unit: 'carton', qty: 4, unit_price: 6 }] },
    });
    const zero = await h.one(`select stock_units from products where id = $1`, [productB]);
    expect(n(zero.stock_units)).toBe(0);

    await h.rpc('create_purchase', {
      p: { supplier_id: supplierId, paid: 0, items: [{ product_id: productB, unit: 'carton', qty: 2, unit_cost: 6.0 }] },
    });
    const pb = await h.one(`select stock_units, avg_unit_cost from products where id = $1`, [productB]);
    expect(n(pb.stock_units)).toBe(24);
    expect(n(pb.avg_unit_cost)).toBeCloseTo(0.5, 6);
  });
});

describe('المصروفات وإغلاق الصندوق', () => {
  it('مصروف ثم إلغاؤه يعكس حركة الصندوق', async () => {
    const cat = await h.one<{ id: string }>(`select id from expense_categories where name = 'بنزين ووقود'`);
    const res = await h.rpc('create_expense', { p: { category_id: cat.id, amount: 25, method: 'cash', notes: 'تعبئة' } });
    expect(String(res.expense_no)).toMatch(/^EXP-/);
    await h.rpc('void_expense', { p_expense_id: res.id, p_reason: 'مكرر' });
    const last = await h.one(`select tx_type, direction, amount from cash_transactions order by id desc limit 1`);
    expect(last.tx_type).toBe('adjustment');
    expect(last.direction).toBe('in');
    expect(n(last.amount)).toBe(25);
  });

  it('إغلاق اليوم: المتوقع من الحركات، والفرق يُسجّل، والتكرار ممنوع', async () => {
    const sums = await h.one(
      `select coalesce(sum(amount) filter (where direction='in'),0) as inflow,
              coalesce(sum(amount) filter (where direction='out'),0) as outflow
       from cash_transactions where method = 'cash'`,
    );
    const expected = Math.round((n(sums.inflow) - n(sums.outflow)) * 1000) / 1000;

    const res = await h.rpc('close_cash_session', { p: { actual_cash: 100, notes: 'أول إغلاق' } });
    expect(n(res.expected_cash)).toBeCloseTo(expected, 3);
    expect(n(res.difference)).toBeCloseTo(100 - expected, 3);

    await h.rpcFail('close_cash_session', { p: { actual_cash: 100 } }, 'SESSION_EXISTS');
  });
});

describe('الصلاحيات والحماية', () => {
  it('موظف المبيعات لا يستطيع الشراء ولا الإلغاء ولا التسوية', async () => {
    await h.actAs(SALES_ID);
    await h.rpcFail(
      'create_purchase',
      { p: { supplier_id: supplierId, paid: 0, items: [{ product_id: productA, unit: 'carton', qty: 1, unit_cost: 7 }] } },
      'AUTH_FORBIDDEN',
    );
    await h.rpcFail('void_sale', { p_sale_id: sale1Id, p_reason: 'x' }, 'AUTH_FORBIDDEN');
    await h.rpcFail('adjust_stock', { p: { product_id: productA, mode: 'delta', qty_units: 1, reason: 'x' } }, 'AUTH_FORBIDDEN');
    await h.actAs(OWNER_ID);
  });

  it('الحذف النهائي للمستندات المالية ممنوع حتى بصلاحيات مباشرة', async () => {
    await expect(h.q(`delete from sales where id = $1`, [sale1Id])).rejects.toThrow(/DELETE_FORBIDDEN/);
    await expect(h.q(`delete from cash_transactions where id in (select id from cash_transactions limit 1)`)).rejects.toThrow(/DELETE_FORBIDDEN/);
  });

  it('الترقيم تسلسلي وفريد', async () => {
    const rows = await h.q<{ invoice_no: string }>(`select invoice_no from sales order by created_at`);
    const numbers = rows.map((r) => Number(r.invoice_no.split('-')[2]));
    expect(numbers).toEqual([...Array(numbers.length)].map((_, i) => i + 1));
  });

  it('كشف الحساب: الرصيد الختامي = رصيد العميل الفعلي', async () => {
    const stmt = await h.rpc('customer_statement', {
      p_customer_id: customerId,
      p_from: '2000-01-01',
      p_to: '2100-01-01',
    });
    const cust = await h.one(`select balance from customers where id = $1`, [customerId]);
    expect(n(stmt.closing_balance)).toBeCloseTo(n(cust.balance), 3);
    expect(n(stmt.opening_balance)).toBe(0);
  });
});
