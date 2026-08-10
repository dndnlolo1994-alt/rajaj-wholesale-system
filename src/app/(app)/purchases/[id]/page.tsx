import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage } from '@/lib/perms';
import { getPurchaseFull } from '@/server/queries/purchases';
import { voidPurchaseAction } from '@/server/actions/purchases';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Money, PageHeader } from '@/components/ui/misc';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VoidDialog } from '@/components/void-dialog';
import { fmtDateTime } from '@/lib/format/date';
import { unitLabel } from '@/lib/calc/units';
import { paymentMethodLabels } from '@/lib/settings';
import { PayDialog } from './pay-dialog';

export const dynamic = 'force-dynamic';

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const purchase = await getPurchaseFull(id);
  if (!purchase) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        title={`فاتورة مشتريات ${purchase.invoice_no}`}
        description={fmtDateTime(purchase.purchase_date)}
        actions={
          <>
            <Link href="/purchases">
              <Button variant="ghost" size="sm">
                <ArrowRight className="size-4" />
                المشتريات
              </Button>
            </Link>
            {purchase.status === 'completed' && purchase.remaining > 0 && purchase.supplier ? (
              <PayDialog
                supplierId={purchase.supplier.id}
                supplierName={purchase.supplier.name}
                purchaseId={purchase.id}
                remaining={Number(purchase.remaining)}
              />
            ) : null}
            {purchase.status === 'completed' && canManage(profile.role) ? (
              <VoidDialog
                id={purchase.id}
                label="فاتورة المشتريات"
                action={voidPurchaseAction}
                buttonLabel="إلغاء الفاتورة"
                description="سيُخصم المخزون المُضاف وتُعكس الحركة المالية ورصيد المورد، ويُسترد أي مبلغ مدفوع. تبقى الفاتورة في السجل بحالة ملغاة."
              />
            ) : null}
          </>
        }
      />

      {purchase.status === 'void' ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          فاتورة ملغاة — السبب: {purchase.void_reason ?? '—'} ({fmtDateTime(purchase.voided_at)})
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* الأصناف */}
          <Card>
            <CardHeader title={`الأصناف (${purchase.items.length})`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs text-ink-500">
                    <th className="px-4 py-2.5 text-start font-bold">الصنف</th>
                    <th className="px-2 py-2.5 text-center font-bold">الكمية</th>
                    <th className="px-2 py-2.5 text-end font-bold">سعر الوحدة</th>
                    <th className="px-2 py-2.5 text-end font-bold">تكلفة الحبة</th>
                    <th className="px-4 py-2.5 text-end font-bold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {purchase.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/products/${item.product_id}`} className="font-bold hover:text-primary-700 hover:underline">
                          {item.product_name}
                        </Link>
                      </td>
                      <td className="tnum px-2 py-2.5 text-center">
                        {item.qty} {unitLabel[item.unit]}
                      </td>
                      <td className="px-2 py-2.5 text-end"><Money value={item.unit_cost} symbol={false} /></td>
                      <td className="px-2 py-2.5 text-end">
                        <span className="tnum text-xs text-ink-500" dir="ltr">
                          {Number(item.cost_per_unit).toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end"><Money value={item.line_total} symbol={false} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="space-y-1.5 border-t border-ink-100 bg-ink-100/40">
              <SummaryRow label="الإجمالي" value={<Money value={purchase.total} className="text-lg text-primary-900" />} strong />
              <SummaryRow label="المدفوع" value={<Money value={purchase.paid} />} />
              <SummaryRow
                label="المتبقي للمورد"
                value={
                  purchase.remaining > 0 ? (
                    <Money value={purchase.remaining} className="text-red-600" />
                  ) : (
                    <span className="text-sm font-bold text-emerald-700">مدفوعة بالكامل ✓</span>
                  )
                }
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {/* المورد */}
          <Card>
            <CardHeader title="المورد" />
            <CardBody>
              {purchase.supplier ? (
                <Link href={`/suppliers/${purchase.supplier.id}`} className="block hover:text-primary-700">
                  <p className="text-base font-extrabold">{purchase.supplier.name}</p>
                  {purchase.supplier.company_name ? (
                    <p className="text-sm text-ink-500">{purchase.supplier.company_name}</p>
                  ) : null}
                  {purchase.supplier.phone ? (
                    <p className="tnum mt-1 text-sm text-ink-500" dir="ltr">{purchase.supplier.phone}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-500">
                    رصيده الحالي (له علينا): <Money value={purchase.supplier.balance} signed className="text-xs" />
                  </p>
                </Link>
              ) : (
                <p className="text-sm font-bold text-ink-500">—</p>
              )}
            </CardBody>
          </Card>

          {/* الدفعات */}
          <Card>
            <CardHeader title="الدفعات المرتبطة" />
            {purchase.payments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">لا دفعات مسجّلة</p>
            ) : (
              <div className="divide-y divide-ink-100">
                {purchase.payments.map((p) => (
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
              <p>أنشأها: <span className="font-bold text-ink-700">{purchase.created_by_profile?.full_name ?? '—'}</span></p>
              <p>وقت الإنشاء: {fmtDateTime(purchase.created_at)}</p>
              {purchase.supplier_invoice_no ? (
                <p>
                  رقم فاتورة المورد: <Badge tone="muted"><span dir="ltr">{purchase.supplier_invoice_no}</span></Badge>
                </p>
              ) : null}
              {purchase.notes ? <p className="rounded-lg bg-amber-50 p-2 text-amber-800">ملاحظة: {purchase.notes}</p> : null}
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
