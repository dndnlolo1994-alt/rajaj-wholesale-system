import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage, canSeeProfit } from '@/lib/perms';
import { getReturnFull } from '@/server/queries/returns';
import { voidReturnAction } from '@/server/actions/returns';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Money, PageHeader } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VoidDialog } from '@/components/void-dialog';
import { fmtDateTime } from '@/lib/format/date';
import { unitLabel } from '@/lib/calc/units';
import { paymentMethodLabels } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const ret = await getReturnFull(id);
  if (!ret) notFound();

  const showProfit = canSeeProfit(profile.role);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`مرتجع ${ret.return_no}`}
        description={fmtDateTime(ret.return_date)}
        actions={
          <>
            <Link href="/returns">
              <Button variant="ghost" size="sm">
                <ArrowRight className="size-4" />
                المرتجعات
              </Button>
            </Link>
            {ret.status === 'completed' && canManage(profile.role) ? (
              <VoidDialog
                id={ret.id}
                label="المرتجع"
                action={voidReturnAction}
                buttonLabel="إلغاء المرتجع"
                description="سيُخصم ما أُعيد للمخزون وتُعكس الحركة المالية ورصيد العميل، ويُسترد أي مبلغ رُدّ نقدًا. يبقى المرتجع في السجل بحالة ملغاة."
              />
            ) : null}
          </>
        }
      />

      {ret.status === 'void' ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          مرتجع ملغى — السبب: {ret.void_reason ?? '—'} ({fmtDateTime(ret.voided_at)})
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* الأصناف */}
          <Card>
            <CardHeader title={`الأصناف (${ret.items.length})`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs text-ink-500">
                    <th className="px-4 py-2.5 text-start font-bold">الصنف</th>
                    <th className="px-2 py-2.5 text-center font-bold">الكمية</th>
                    <th className="px-2 py-2.5 text-end font-bold">السعر</th>
                    <th className="px-2 py-2.5 text-end font-bold">الإجمالي</th>
                    <th className="px-4 py-2.5 text-center font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {ret.items.map((item) => (
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
                      <td className="px-2 py-2.5 text-end"><Money value={item.line_total} symbol={false} /></td>
                      <td className="px-4 py-2.5 text-center">
                        {item.condition === 'good' ? (
                          <Badge tone="success">سليم — عاد للمخزون</Badge>
                        ) : (
                          <Badge tone="danger">تالف (خسارة)</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="space-y-1.5 border-t border-ink-100 bg-ink-100/40">
              <SummaryRow label="إجمالي المرتجع" value={<Money value={ret.total} className="text-lg text-primary-900" />} strong />
              {showProfit ? (
                <SummaryRow label="أُعيد للمخزون بقيمة" value={<Money value={ret.restocked_cost_total} />} />
              ) : null}
              <SummaryRow
                label="رد نقدي"
                value={
                  Number(ret.refund_cash) > 0 ? (
                    <span className="flex items-center gap-2">
                      {ret.refund_method ? <Badge tone="muted">{paymentMethodLabels[ret.refund_method]}</Badge> : null}
                      <Money value={ret.refund_cash} />
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-ink-500">خُصم من رصيد العميل</span>
                  )
                }
              />
              {showProfit ? (
                <SummaryRow label="أثر الربح" value={<Money value={ret.profit_delta} signed />} />
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {/* الفاتورة الأصل */}
          <Card>
            <CardHeader title="الفاتورة الأصل" />
            <CardBody>
              {ret.sale ? (
                <Link href={`/sales/${ret.sale.id}`} className="block hover:text-primary-700">
                  <p className="tnum text-base font-extrabold" dir="ltr">{ret.sale.invoice_no}</p>
                  <p className="mt-1 text-xs text-ink-500">اضغط لفتح تفاصيل الفاتورة</p>
                </Link>
              ) : (
                <p className="text-sm font-bold text-ink-500">—</p>
              )}
            </CardBody>
          </Card>

          {/* العميل */}
          <Card>
            <CardHeader title="العميل" />
            <CardBody>
              {ret.customer ? (
                <Link href={`/customers/${ret.customer.id}`} className="block hover:text-primary-700">
                  <p className="text-base font-extrabold">{ret.customer.name}</p>
                  {ret.customer.shop_name ? <p className="text-sm text-ink-500">{ret.customer.shop_name}</p> : null}
                </Link>
              ) : (
                <p className="text-sm font-bold text-ink-500">زبون نقدي (بدون تسجيل)</p>
              )}
            </CardBody>
          </Card>

          {/* معلومات */}
          <Card>
            <CardBody className="space-y-1.5 text-xs text-ink-500">
              <p>أنشأه: <span className="font-bold text-ink-700">{ret.created_by_profile?.full_name ?? '—'}</span></p>
              <p>وقت الإنشاء: {fmtDateTime(ret.created_at)}</p>
              {ret.reason ? <p>سبب المرتجع: <span className="font-bold text-ink-700">{ret.reason}</span></p> : null}
              {ret.notes ? <p className="rounded-lg bg-amber-50 p-2 text-amber-800">ملاحظة: {ret.notes}</p> : null}
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
