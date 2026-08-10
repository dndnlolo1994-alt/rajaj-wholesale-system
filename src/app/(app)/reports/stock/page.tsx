import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { reportStagnant, stockByCategory } from '@/server/queries/reports';
import { ExportButton } from '@/components/reports/export-button';
import { EmptyState, Money, PageHeader, StatCard } from '@/components/ui/misc';
import { Card, CardHeader } from '@/components/ui/card';
import { formatQty } from '@/lib/calc/units';
import { fmtDateShort, todayISO } from '@/lib/format/date';

export const metadata = { title: 'تقرير المخزون والركود' };
export const dynamic = 'force-dynamic';

export default async function StockReportPage() {
  const profile = await requireProfile();
  const showProfit = canSeeProfit(profile.role);
  const today = todayISO();

  const [stock, stagnant] = await Promise.all([stockByCategory(), reportStagnant()]);

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="المخزون والركود"
        description="قيمة المخزون حسب القسم والأصناف الراكدة"
        actions={<ExportButton reportKey="stock" from={today} to={today} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {showProfit ? (
          <StatCard
            title="قيمة المخزون"
            value={<Money value={stock.totals.value} />}
            icon={<Boxes className="size-5" />}
          />
        ) : null}
        <StatCard title="أصناف فعالة" value={<span className="tnum">{stock.totals.products}</span>} />
        <StatCard title="إجمالي الكمية" value={<span className="tnum">{stock.totals.units}</span>} sub="بالحبة" />
      </div>

      {/* ===== قيمة المخزون حسب القسم ===== */}
      <Card className="mb-4">
        <CardHeader title="قيمة المخزون حسب القسم" />
        {stock.rows.length === 0 ? (
          <EmptyState title="لا أصناف فعالة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">القسم</th>
                  <th className="px-4 py-3 text-end font-bold">عدد الأصناف</th>
                  <th className="px-4 py-3 text-end font-bold">الكمية (حبة)</th>
                  {showProfit ? <th className="px-4 py-3 text-end font-bold">القيمة</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stock.rows.map((r) => (
                  <tr key={r.category} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3 font-bold">{r.category}</td>
                    <td className="tnum px-4 py-3 text-end">{r.products}</td>
                    <td className="tnum px-4 py-3 text-end">{r.units}</td>
                    {showProfit ? (
                      <td className="px-4 py-3 text-end"><Money value={r.value} /></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-300 bg-ink-100/50 font-extrabold">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="tnum px-4 py-3 text-end">{stock.totals.products}</td>
                  <td className="tnum px-4 py-3 text-end">{stock.totals.units}</td>
                  {showProfit ? (
                    <td className="px-4 py-3 text-end"><Money value={stock.totals.value} /></td>
                  ) : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* ===== الأصناف الراكدة ===== */}
      <Card>
        <CardHeader
          title={
            <>
              الأصناف الراكدة{' '}
              <span className="text-xs font-medium text-ink-500">
                (لم تُبع منذ {stagnant.days} يومًا أو أكثر)
              </span>
            </>
          }
        />
        {stagnant.rows.length === 0 ? (
          <EmptyState title="لا أصناف راكدة" description="كل الأصناف تتحرك ✓" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">الصنف</th>
                  <th className="px-4 py-3 text-start font-bold">المخزون</th>
                  {showProfit ? <th className="px-4 py-3 text-end font-bold">القيمة</th> : null}
                  <th className="px-4 py-3 text-start font-bold">آخر بيع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stagnant.rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/products/${r.id}`} className="font-bold text-primary-700 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="tnum px-4 py-3">{formatQty(r.stock_units, r.units_per_carton)}</td>
                    {showProfit ? (
                      <td className="px-4 py-3 text-end"><Money value={r.stock_value} /></td>
                    ) : null}
                    <td className="px-4 py-3 text-ink-500">
                      {r.last_sale_at ? fmtDateShort(r.last_sale_at) : <span className="text-red-600 font-bold">لم يُبع</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
