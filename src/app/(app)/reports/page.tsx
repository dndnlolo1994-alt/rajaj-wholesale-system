import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote, Boxes, CalendarCheck, ClipboardList, HandCoins,
  FileDown, PackagePlus, PackageSearch, ReceiptText, RotateCcw, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage, canSeeProfit } from '@/lib/perms';
import { PageHeader } from '@/components/ui/misc';

export const metadata = { title: 'التقارير' };
export const dynamic = 'force-dynamic';

interface ReportCard {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

export default async function ReportsHubPage() {
  const profile = await requireProfile();
  const showProfit = canSeeProfit(profile.role);
  const manager = canManage(profile.role);

  const cards: ReportCard[] = [
    { href: '/reports/sales', icon: ReceiptText, title: 'المبيعات', desc: 'إجماليات الفترات مع الخصومات والمرتجعات' },
    ...(showProfit
      ? [{ href: '/profit', icon: TrendingUp, title: 'الأرباح', desc: 'قائمة دخل مبسطة وهوامش الربح' }]
      : []),
    { href: '/reports/products', icon: PackageSearch, title: 'حسب الصنف', desc: 'الأكثر مبيعًا وإيرادًا في الفترة' },
    { href: '/reports/customers', icon: Users, title: 'حسب العميل', desc: 'مشتريات العملاء ومدفوعاتهم وأرصدتهم' },
    { href: '/reports/purchases', icon: PackagePlus, title: 'المشتريات', desc: 'مشتريات الفترة مجمّعة حسب المورد' },
    { href: '/reports/returns', icon: RotateCcw, title: 'المرتجعات', desc: 'مرتجعات الفترة وقيمها وأسبابها' },
    { href: '/reports/expenses', icon: Banknote, title: 'المصاريف', desc: 'المصاريف حسب التصنيف ونسبتها' },
    { href: '/reports/debts', icon: HandCoins, title: 'الديون', desc: 'أعمار ديون العملاء والموردين' },
    { href: '/reports/stock', icon: Boxes, title: 'المخزون والركود', desc: 'قيمة المخزون حسب القسم والأصناف الراكدة' },
    { href: '/day-summary', icon: CalendarCheck, title: 'ملخص اليوم', desc: 'حركة يوم كامل وتقرير الإغلاق' },
    { href: '/cashbox', icon: Wallet, title: 'حركة الصندوق', desc: 'المقبوضات والمدفوعات ورصيد الصندوق' },
    ...(manager
      ? [{ href: '/audit', icon: ClipboardList, title: 'سجل التدقيق', desc: 'من فعل ماذا ومتى في النظام' }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="التقارير"
        description="اختر تقريرًا لعرضه وتصفيته وطباعته"
        actions={manager ? (
          <a
            href="/api/reports/full-pdf"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-l from-primary-700 to-primary-600 px-4 text-sm font-extrabold text-white shadow-luxe transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <FileDown className="size-4" />
            تنزيل التقرير الكامل PDF
          </a>
        ) : null}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex h-full flex-col gap-2.5 rounded-[--radius-card] border border-ink-200 bg-white p-4 shadow-card transition-shadow hover:shadow-pop"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <c.icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-ink-900 group-hover:text-primary-800">{c.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-500">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
