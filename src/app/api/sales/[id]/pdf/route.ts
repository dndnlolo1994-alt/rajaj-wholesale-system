import { NextResponse, type NextRequest } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getSaleFull } from '@/server/queries/sales';
import { buildSaleInvoicePdf } from '@/lib/pdf/sale-invoice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await ctx.params;
  const sale = await getSaleFull(id);
  if (!sale) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: privateHeaders });
  }

  const settings = await getSettings();
  const pdf = await buildSaleInvoicePdf(sale, settings.business);
  const disposition = request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline';

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      ...privateHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${pdf.fileName}"`,
      'Content-Length': String(pdf.buffer.byteLength),
    },
  });
}
