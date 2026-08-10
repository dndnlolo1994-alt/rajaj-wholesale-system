import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { buildStatementReceipt } from '@/lib/printing/receipt-model';
import { ReceiptView } from '@/components/printing/receipt-view';
import { PrintController } from '@/components/printing/print-controller';
import { formatJOD } from '@/lib/calc/money';
import { fmtDateShort, monthStartISO, todayISO } from '@/lib/format/date';

export const dynamic = 'force-dynamic';

// أنواع قيود الكشف بالعربي
const ledgerTypeLabels: Record<string, string> = {
  opening: 'رصيد سابق',
  sale: 'فاتورة',
  purchase: 'مشتريات',
  payment: 'دفعة',
  return: 'مرتجع',
  adjustment: 'تسوية',
  void: 'إلغاء',
};

interface StatementRow {
  id: number;
  entry_type: string;
  ref_table: string | null;
  ref_id: string | null;
  debit: number;
  credit: number;
  entry_date: string;
  notes: string | null;
  running_balance: number;
}

interface SupplierStatementData {
  supplier: { id: string; name: string; company_name: string | null; phone: string | null } | null;
  opening_balance: number;
  rows: StatementRow[];
  total_debit: number;
  total_credit: number;
  closing_balance: number;
}

const jod = (n: number | string) => formatJOD(Number(n), { symbol: false });
const shortNotes = (s: string | null) => (s ? (s.length > 30 ? `${s.slice(0, 30)}…` : s) : '');

export default async function PrintSupplierStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; auto?: string; w?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const from = sp.from ?? monthStartISO(0);
  const to = sp.to ?? todayISO();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('supplier_statement', {
    p_supplier_id: id,
    p_from: from,
    p_to: to,
  });
  if (error || !data) notFound();
  const st = data as SupplierStatementData;
  if (!st.supplier) notFound();

  const settings = await getSettings();
  const width = sp.w === '58' ? 58 : sp.w === '80' ? 80 : settings.printer.paper_width;
  const printerSettings = { ...settings.printer, paper_width: width as 58 | 80 };

  const doc = buildStatementReceipt({
    business: settings.business,
    title: 'كشف حساب مورد',
    subtitle: [st.supplier.name, st.supplier.company_name].filter(Boolean).join(' — '),
    meta: [
      { label: 'الفترة', value: `${fmtDateShort(from)} — ${fmtDateShort(to)}` },
      ...(st.supplier.phone ? [{ label: 'الهاتف', value: st.supplier.phone }] : []),
    ],
    columns: ['البيان', 'مدين', 'دائن', 'الرصيد'],
    rows: st.rows.map((r) => [
      `${ledgerTypeLabels[r.entry_type] ?? r.entry_type}${r.notes ? ` — ${shortNotes(r.notes)}` : ''}`,
      jod(r.debit),
      jod(r.credit),
      jod(r.running_balance),
    ]),
    totals: [
      { label: 'الرصيد السابق', value: jod(st.opening_balance) },
      { label: 'إجمالي مدين', value: jod(st.total_debit) },
      { label: 'إجمالي دائن', value: jod(st.total_credit) },
      { label: 'الرصيد النهائي (له علينا)', value: `${jod(st.closing_balance)} د.أ`, bold: true, lg: true },
    ],
  });

  return (
    <div>
      <title>{`كشف حساب مورد — ${st.supplier.name}`}</title>
      <PrintController blocks={doc.blocks} settings={printerSettings} auto={sp.auto === '1'} />
      <div className="rounded-lg bg-white p-3 shadow-card print:rounded-none print:p-0 print:shadow-none">
        <ReceiptView blocks={doc.blocks} width={width as 58 | 80} />
      </div>
    </div>
  );
}
