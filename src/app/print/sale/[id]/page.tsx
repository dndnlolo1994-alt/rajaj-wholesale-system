import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getSaleFull } from '@/server/queries/sales';
import { buildSaleReceipt } from '@/lib/printing/receipt-model';
import { ReceiptView } from '@/components/printing/receipt-view';
import { PrintController } from '@/components/printing/print-controller';

export const dynamic = 'force-dynamic';

export default async function PrintSalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; w?: string; mode?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const sp = await searchParams;

  const sale = await getSaleFull(id);
  if (!sale) notFound();

  const settings = await getSettings();
  const width = sp.w === '58' ? 58 : sp.w === '80' ? 80 : settings.printer.paper_width;
  const printerSettings = {
    ...settings.printer,
    mode: sp.mode === 'browser' ? 'browser' as const : settings.printer.mode,
    paper_width: width as 58 | 80,
  };
  const doc = buildSaleReceipt(sale, settings.business);

  return (
    <div>
      <title>{doc.title}</title>
      <PrintController blocks={doc.blocks} settings={printerSettings} auto={sp.auto === '1'} pdfUrl={`/api/sales/${sale.id}/pdf`} />
      <div className="rounded-lg bg-white p-3 shadow-card print:rounded-none print:p-0 print:shadow-none">
        <ReceiptView blocks={doc.blocks} width={width as 58 | 80} />
      </div>
    </div>
  );
}
