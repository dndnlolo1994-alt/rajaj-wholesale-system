'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LayoutGrid, LogOut, Search, ShoppingCart, Store, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { navGroups, visibleGroups } from './nav-items';
import { GlobalSearch } from './global-search';
import type { UserRole } from '@/lib/types/db';
import { roleLabelsClient } from './role-labels';

interface ShellProps {
  profile: { full_name: string; role: UserRole };
  businessName: string;
  unreadCount: number;
  children: React.ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ profile, businessName, unreadCount, children }: ShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const groups = visibleGroups(profile.role);

  const bottomItems = [
    { href: '/', label: 'الرئيسية' },
    { href: '/customers', label: 'العملاء' },
    { href: '/pos', label: 'بيع جديد', primary: true },
    { href: '/products', label: 'المخزون' },
  ];

  return (
    <div className="min-h-dvh lg:flex">
      {/* ===== الشريط الجانبي (شاشات كبيرة) ===== */}
      <aside className="no-print fixed inset-y-0 right-0 z-40 hidden w-56 flex-col overflow-hidden bg-primary-950 text-primary-100 shadow-2xl lg:flex">
        <div className="relative flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/8 text-gold-100 shadow-inner ring-1 ring-white/10">
            <Store className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-white">رجائي المصري</p>
            <p className="truncate text-[11px] text-primary-300/80">إدارة التوزيع والجملة</p>
          </div>
        </div>
        <nav className="relative flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-400/70">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-bold transition-colors',
                        active
                          ? 'bg-white/12 text-white shadow-lg ring-1 ring-white/10'
                          : 'text-primary-200/90 hover:bg-white/7 hover:text-white',
                      )}
                    >
                      <item.icon className="size-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.href === '/notifications' && unreadCount > 0 ? (
                        <span className="tnum ms-auto rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                          {unreadCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="relative border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2 py-2 ring-1 ring-white/5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-extrabold text-white ring-1 ring-white/10">
              {profile.full_name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{profile.full_name}</p>
              <p className="text-[11px] text-primary-300/80">{roleLabelsClient[profile.role]}</p>
            </div>
            <Link href="/logout" prefetch={false} className="rounded-lg p-1.5 text-primary-300 hover:bg-white/10 hover:text-white" title="تسجيل الخروج">
              <LogOut className="size-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* ===== المحتوى ===== */}
      <div className="flex min-h-dvh w-full flex-col lg:pr-56">
        {/* الشريط العلوي */}
        <header className="no-print sticky top-0 z-30 border-b border-ink-200/80 bg-white/90 shadow-[0_1px_16px_-14px_rgba(5,42,36,.45)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-800 text-white shadow-card">
                <Store className="size-4.5" />
              </div>
              <span className="text-sm font-extrabold text-ink-900">{businessName}</span>
            </Link>
            <div className="flex-1" />
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-10 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-500 shadow-sm transition-all hover:border-primary-200 lg:w-80"
            >
              <Search className="size-4" />
              <span className="hidden lg:inline">بحث شامل — عميل، صنف، فاتورة، باركود</span>
              <span className="lg:hidden">بحث</span>
              <kbd className="ms-auto hidden rounded border border-ink-300 bg-white px-1.5 text-[10px] font-bold text-ink-500 lg:inline">
                Ctrl K
              </kbd>
            </button>
            <Link
              href="/notifications"
              className="relative rounded-lg p-2 text-ink-700 transition-colors hover:bg-ink-100"
              aria-label="التنبيهات"
            >
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <span className="tnum absolute -top-0.5 -start-0.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99' : unreadCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>

        <main className="animate-pop mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-4 lg:px-6 lg:pb-10 lg:pt-5">{children}</main>
      </div>

      {/* ===== شريط الجوال السفلي ===== */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/80 bg-white/88 shadow-[0_-12px_32px_-24px_rgba(5,42,36,.5)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {bottomItems.slice(0, 2).map((item) => (
            <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          {/* زر البيع المركزي */}
          <Link href="/pos" className="relative flex flex-col items-center justify-center py-1.5">
            <span
              className={cn(
                'flex size-12 -translate-y-3 items-center justify-center rounded-2xl shadow-pop transition-transform active:scale-95',
                isActive(pathname, '/pos')
                  ? 'bg-gradient-to-br from-primary-700 to-primary-950 text-white ring-2 ring-gold-300/50'
                  : 'bg-gradient-to-br from-primary-600 to-primary-900 text-white ring-2 ring-white',
              )}
            >
              <ShoppingCart className="size-6" />
            </span>
            <span className="-mt-2 text-[10px] font-extrabold text-primary-800">بيع جديد</span>
          </Link>
          {bottomItems.slice(3).map((item) => (
            <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center gap-0.5 py-2 text-ink-500">
            <LayoutGrid className="size-5" />
            <span className="text-[10px] font-bold">المزيد</span>
          </button>
        </div>
      </nav>

      {/* ===== قائمة المزيد (جوال) ===== */}
      {moreOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setMoreOpen(false)} />
          <div className="animate-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3">
              <p className="text-base font-extrabold">كل الأقسام</p>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {groups.map((group) => (
                <div key={group.title}>
                  <p className="pb-2 text-xs font-bold text-ink-500">{group.title}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
                          isActive(pathname, item.href)
                            ? 'border-primary-300 bg-primary-50 text-primary-800'
                            : 'border-ink-200 text-ink-700 hover:bg-ink-100',
                        )}
                      >
                        <item.icon className="size-5" />
                        <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <Link
                href="/logout"
                prefetch={false}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"
              >
                <LogOut className="size-4" />
                تسجيل الخروج
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={() => setSearchOpen(true)} />
    </div>
  );
}

function BottomLink({ item, active }: { item: { href: string; label: string }; active: boolean }) {
  const Icon = navGroups.flatMap((g) => g.items).find((i) => i.href === item.href)?.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 py-2',
        active ? 'text-primary-800' : 'text-ink-500',
      )}
    >
      {Icon ? <Icon className="size-5" /> : null}
      <span className="text-[10px] font-bold">{item.label}</span>
    </Link>
  );
}
