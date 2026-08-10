import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage, canSeeProfit } from '@/lib/perms';
import { getSaleFull } from '@/server/queries/sales';
import { voidSaleAction } from '@/server/actions/sales';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Money, PageHeader } from '@/components/ui/misc';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VoidDialog } from '@/components/void-dialog';
import { PrintButton } from '@/components/printing/print-button';
import { InvoicePdfButton } from '@/components/printing/invoice-pdf-button';
import { fmtDateTime } from '@/lib/format/date';
import { unitLabel } from '@/lib/calc/units';
import { formatPercent, marginPercent } from '@/lib/calc/money';
import { paymentMethodLabels } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const sale = await getSaleFull(id);
  if (!sale) notFound();

  const showProfit = canSeeProfit(profile.role);
  const activeReturns = sale.returns.filter((r) => r.status === 'completed');
  const returnsTotal = activeReturns.reduce((a, r) => a + Number(r.total), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`فاتورة ${sale.invoice_no}`}
        description={fmtDateTime(sale.sale_date)}
        actions={
          <>
            <Link href="/sales">
              <Button variant="ghost" size="sm">
                <ArrowRight className="size-4" />
                الفواتير
              </Button>
            </Link>
            <PrintButton kind="sale" id={sale.id} />
            <InvoicePdfButton id={sale.id} invoiceNo={sale.invoice_no} />
            {sale.status === 'completed' ? (
              <Link href={`/returns/new?sale=${sale.id}`}>
                <Button variant="secondary">
                  <RotateCcw className="size-4" />
                  إنشاء مرتجع
                </Button>
              </Link>
            ) : null}
            {sale.status === 'completed' && canManage(profile.role) ? (
              <VoidDialog
                id={sale.id}
                label="الفاتورة"
                action={voidSaleAction}
                buttonLabel="إلغاء الفاتورة"
                description="سيُعاد المخزون وتُعكس الحركة المالية ورصيد العميل، ويُرد المبلغ المقبوض. تبقى الفاتورة في السجل بحالة ملغاة."
              />
            ) : null}
          </>
        }
      />

      {sale.status === 'void' ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          فاتورة ملغاة — السبب: {sale.void_reason ?? '—'} ({fmtDateTime(sale.voided_at)})
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* الأصناف */}
          <Card>
            <CardHeader title={`الأصناف (${sale.items.length})`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs text-ink-500">
                    <th className="px-4 py-2.5 text-start font-bold">الصنف</th>
                    <th className="px-2 py-2.5 text-center font-bold">الكمية</th>
                    <th className="px-2 py-2.5 text-end font-bold">السعر</th>
                    <th className="px-2 py-2.5 text-end font-bold">الخصم</th>
                    <th className="px-4 py-2.5 text-end font-bold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/products/${item.product_id}`} className="font-bold hover:text-primary-700 hover:underline">
                          {item.product_name}
                        </Link>
                      </td>
                      <td className="tnum px-2 py-2.5 text-center">
                        {item.qty} {unitLabel[item.unit]}
                      </td>
                      <td className="px-2 py-2.5 text-end"><Money value={item.unit_price} symbol={false} /></td>
                      <td className="px-2 py-2.5 text-end">
                        {item.discount > 0 || item.inv_discount_share > 0 ? (
                          <Money value={Number(item.discount) + Number(item.inv_discount_share)} symbol={false} className="text-amber-700" />
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-end"><Money value={item.net_total} symbol={false} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="space-y-1.5 border-t border-ink-100 bg-ink-100/40">
              <SummaryRow label="المجموع" value={<Money value={sale.subtotal} />} />
              {Number(sale.line_discount_total) > 0 ? (
                <SummaryRow label="خصومات الأصناف" value={<Money value={sale.line_discount_total} className="text-amber-700" />} />
              ) : null}
              {Number(sale.invoice_discount) > 0 ? (
                <SummaryRow label="خصم الفاتورة" value={<Money value={sale.invoice_discount} className="text-amber-700" />} />
              ) : null}
              <SummaryRow label="الإجمالي" value={<Money value={sale.total} className="text-lg text-primary-900" />} strong />
              <SummaryRow label="المدفوع" value={<Money value={sale.paid} />} />
              <SummaryRow
                label="المتبقي"
                value={
                  sale.remaining > 0 ? <Money value={sale.remaining} className="text-red-600" /> : <span className="text-sm font-bold text-emerald-700">مدفوعة بالكامل ✓</span>
                }
              />
              {returnsTotal > 0 ? (
                <SummaryRow label="مرتجعات على الفاتورة" value={<Money value={returnsTotal} className="text-red-600" />} />
              ) : null}
            </CardBody>
          </Card>

          {/* المرتجعات */}
          {sale.returns.length > 0 ? (
            <Card>
              <CardHeader title="المرتجعات" />
              <div className="divide-y divide-ink-100">
                {sale.returns.map((r) => (
                  <Link key={r.id} href={`/returns/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-primary-50/40">
                    <div>
                      <p className="text-sm font-bold">{r.return_no}</p>
                      <p className="text-xs text-ink-500">
                        {fmtDateTime(r.return_date)} — {r.items.length} صنف {r.reason ? `— ${r.reason}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <Money value={r.total} />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {/* العميل */}
          <Card>
            <CardHeader title="العميل" />
            <CardBody>
              {sale.customer ? (
                <Link href={`/customers/${sale.customer.id}`} className="block hover:text-primary-700">
                  <p className="text-base font-extrabold">{sale.customer.name}</p>
                  {sale.customer.shop_name ? <p className="text-sm text-ink-500">{sale.customer.shop_name}</p> : null}
                  {sale.customer.phone ? <p className="tnum mt-1 text-sm text-ink-500" dir="ltr">{sale.customer.phone}</p> : null}
                  <p className="mt-2 text-xs text-ink-500">
                    رصيده الحالي: <Money value={sale.customer.balance} signed className="text-xs" />
                  </p>
                </Link>
              ) : (
                <p className="text-sm font-bold text-ink-500">زبون نقدي (بدون تسجيل)</p>
              )}
            </CardBody>
          </Card>

          {/* الربح — داخلي فقط */}
          {showProfit && sale.status === 'completed' ? (
            <Card>
              <CardHeader title="الربحية (داخلي — لا يظهر للعميل)" />
              <CardBody className="space-y-1.5">
                <SummaryRow label="تكلفة البضاعة" value={<Money value={sale.cost_total} />} />
                <SummaryRow label="الربح" value={<Money value={sale.profit} signed />} strong />
                <SummaryRow
                  label="هامش الربح"
                  value={<span className="tnum text-sm font-bold">{formatPercent(marginPercent(Number(sale.cost_total), Number(sale.total)))}</span>}
                />
              </CardBody>
            </Card>
          ) : null}

          {/* الدفعات */}
          <Card>
            <CardHeader title="الدفعات المرتبطة" />
            {sale.payments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">لا دفعات مسجّلة</p>
            ) : (
              <div className="divide-y divide-ink-100">
                {sale.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="tnum text-sm font-bold" dir="ltr">{p.payment_no}</p>
                      <p className="text-xs text-ink-500">
                        {fmtDateTime(p.payment_date)} — {paymentMethodLabels[p.method]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === 'void' ? <StatusBadge status="void" /> : null}
                      <Money value={p.amount} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* معلومات */}
          <Card>
            <CardBody className="space-y-1.5 text-xs text-ink-500">
              <p>أنشأها: <span className="font-bold text-ink-700">{sale.created_by_profile?.full_name ?? '—'}</span></p>
              <p>وقت الإنشاء: {fmtDateTime(sale.created_at)}</p>
              {sale.payment_method ? <p>طريقة الدفع: <Badge tone="muted">{paymentMethodLabels[sale.payment_method]}</Badge></p> : null}
              {sale.notes ? <p className="rounded-lg bg-amber-50 p-2 text-amber-800">ملاحظة: {sale.notes}</p> : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${strong ? 'font-extrabold' : 'text-ink-500'}`}>{label}</span>
      {value}
    </div>
  );
}
