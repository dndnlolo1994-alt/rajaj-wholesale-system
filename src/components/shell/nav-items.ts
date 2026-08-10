import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid, ShoppingCart, ReceiptText, RotateCcw, PackagePlus, Users, Building2,
  HandCoins, Wallet, Coins, TrendingUp, CalendarDays, BarChart3, NotebookPen,
  Bell, ScrollText, DatabaseBackup, Settings, Boxes, ClipboardList,
} from 'lucide-react';
import type { UserRole } from '@/lib/types/db';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: 'العمليات',
    items: [
      { href: '/pos', label: 'بيع جديد', icon: ShoppingCart, roles: ['owner', 'manager', 'sales'] },
      { href: '/dashboard', label: 'لوحة القيادة', icon: LayoutGrid },
      { href: '/sales', label: 'الفواتير', icon: ReceiptText },
      { href: '/returns', label: 'المرتجعات', icon: RotateCcw },
      { href: '/purchases', label: 'المشتريات', icon: PackagePlus, roles: ['owner', 'manager', 'warehouse', 'accountant'] },
    ],
  },
  {
    title: 'الأطراف',
    items: [
      { href: '/customers', label: 'العملاء', icon: Users },
      { href: '/suppliers', label: 'الموردون', icon: Building2 },
      { href: '/debts', label: 'الديون', icon: HandCoins },
    ],
  },
  {
    title: 'المخزون',
    items: [
      { href: '/products', label: 'الأصناف', icon: Boxes },
      { href: '/inventory', label: 'المخزون والجرد', icon: ClipboardList },
    ],
  },
  {
    title: 'المال',
    items: [
      { href: '/cashbox', label: 'الصندوق', icon: Wallet, roles: ['owner', 'manager', 'accountant'] },
      { href: '/expenses', label: 'المصروفات', icon: Coins, roles: ['owner', 'manager', 'accountant'] },
      { href: '/profit', label: 'الأرباح', icon: TrendingUp, roles: ['owner', 'manager', 'accountant'] },
      { href: '/day-summary', label: 'ملخص اليوم', icon: CalendarDays },
    ],
  },
  {
    title: 'أدوات',
    items: [
      { href: '/reports', label: 'التقارير', icon: BarChart3 },
      { href: '/notes', label: 'الدفتر اليومي', icon: NotebookPen },
      { href: '/notifications', label: 'التنبيهات', icon: Bell },
      { href: '/audit', label: 'سجل التدقيق', icon: ScrollText, roles: ['owner', 'manager'] },
      { href: '/backup', label: 'النسخ الاحتياطي', icon: DatabaseBackup, roles: ['owner', 'manager'] },
      { href: '/settings', label: 'الإعدادات', icon: Settings, roles: ['owner'] },
    ],
  },
];

export function visibleGroups(role: UserRole): NavGroup[] {
  return navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0);
}
