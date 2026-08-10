import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getCashSession } from '@/server/queries/cashbox';
import { buildStatementReceipt } from '@/lib/printing/receipt-model';
import { ReceiptView } from '@/components/printing/receipt-view';
import { PrintController } from '@/components/printing/print-controller';
import { formatJOD } from '@/lib/calc/money';
import { fmtDateShort } from '@/lib/format/date';

export const dynamic = 'force-dynamic';

export default async function PrintCashSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; w?: string }>;
}) {
  await requireProfile(['owner', 'manager', 'accountant']);
  const { id } = await params;
  const sp = await searchParams;

  const session = await getCashSession(id);
  if (!session) notFound();

  const settings = await getSettings();
  const width = sp.w === '58' ? 58 : sp.w === '80' ? 80 : settings.printer.paper_width;
  const printerSettings = { ...settings.printer, paper_width: width as 58 | 80 };

  const jod = (n: number | string) => formatJOD(Number(n), { symbol: false });
  const meta = [
    { label: 'التاريخ', value: fmtDateShort(session.session_date) },
    { label: 'المُغلق', value: session.closer?.full_name ?? '—' },
  ];
  if (session.notes) meta.push({ label: 'ملاحظات', value: session.notes });

  const doc = buildStatementReceipt({
    business: settings.business,
    title: 'تقرير إغلاق الصندوق',
    meta,
    columns: ['البند', 'القيمة'],
    rows: [
      ['الرصيد الافتتاحي', jod(session.opening_balance)],
      ['النقد الداخل', `+${jod(session.cash_in)}`],
      ['النقد الخارج', `-${jod(session.cash_out)}`],
      ['المتوقع', jod(session.expected_cash)],
      ['الفعلي', jod(session.actual_cash)],
    ],
    totals: [{ label: 'الفرق', value: formatJOD(Number(session.difference)), bold: true, lg: true }],
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
