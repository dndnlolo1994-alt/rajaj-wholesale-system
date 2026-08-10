import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { daySummary } from '@/server/queries/reports';
import { buildStatementReceipt } from '@/lib/printing/receipt-model';
import { ReceiptView } from '@/components/printing/receipt-view';
import { PrintController } from '@/components/printing/print-controller';
import { formatJOD, round3 } from '@/lib/calc/money';
import { fmtDate } from '@/lib/format/date';

export const dynamic = 'force-dynamic';

// تقرير إغلاق اليوم — تقرير داخلي لرجائي (تُطبع فيه الأرباح)
export default async function PrintDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; w?: string }>;
}) {
  await requireProfile();
  const { id } = await params; // [id] = التاريخ YYYY-MM-DD
  const sp = await searchParams;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) notFound();

  const d = await daySummary(id);
  const settings = await getSettings();
  const width = sp.w === '58' ? 58 : sp.w === '80' ? 80 : settings.printer.paper_width;
  const printerSettings = { ...settings.printer, paper_width: width as 58 | 80 };

  const jod = (n: number) => formatJOD(n, { symbol: false });
  const grossProfit = round3(d.sales.profit + d.returns.profit_delta);
  const netProfit = round3(grossProfit - d.expenses.total);

  const doc = buildStatementReceipt({
    business: settings.business,
    title: 'تقرير إغلاق اليوم',
    subtitle: fmtDate(`${d.date}T12:00:00`),
    meta: [],
    columns: ['البند', 'القيمة'],
    rows: [
      [`المبيعات (${d.sales.count} فاتورة)`, jod(d.sales.total)],
      ['المقبوض من المبيعات', jod(d.cash.sale_receipts)],
      ['البيع الآجل', jod(d.sales.credit)],
      ['تحصيل الديون', jod(d.cash.debt_collected)],
      [`المشتريات (${d.purchases.count})`, jod(d.purchases.total)],
      ['المدفوع للموردين', jod(d.cash.supplier_paid)],
      [`المصاريف (${d.expenses.count})`, jod(d.expenses.total)],
      [`المرتجعات (${d.returns.count})`, jod(d.returns.total)],
      ['الرد النقدي', jod(d.returns.refund_cash)],
    ],
    totals: [
      { label: 'تكلفة البضاعة', value: jod(d.sales.cogs) },
      { label: 'مجمل الربح', value: jod(grossProfit) },
      { label: 'صافي الربح', value: `${jod(netProfit)} د.أ`, bold: true, lg: true },
      { label: 'رصيد الصندوق', value: jod(d.cash_balance.balance) },
    ],
    footer: 'تقرير داخلي — لا يُسلَّم للعملاء',
  });

  return (
    <div>
      <title>{doc.title}</title>
      <PrintController blocks={doc.blocks} settings={printerSettings} auto={sp.auto === '1'} />
      <div className="rounded-lg bg-white p-3 shadow-card print:rounded-none print:p-0 print:shadow-none">
        <ReceiptView blocks={doc.blocks} width={width as 58 | 80} />
      </div>
    </div>
  );
}
