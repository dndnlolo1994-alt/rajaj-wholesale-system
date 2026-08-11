'use client';

import { useEffect, useRef, useState } from 'react';
import { UserRound, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/misc';
import { quickCustomersAction, type QuickCustomer } from '@/server/actions/pos';

export function CustomerPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: QuickCustomer | null) => void;
}) {
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<QuickCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cachedCustomers = useRef<QuickCustomer[]>([]);

  useEffect(() => {
    if (!open) return;
    if (cachedCustomers.current.length > 0 && !q.trim()) {
      setCustomers(cachedCustomers.current);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await quickCustomersAction(q);
      if (res.ok) {
        setCustomers(res.data);
        if (!q.trim()) cachedCustomers.current = res.data;
      }
      setLoading(false);
    }, q ? 200 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, open]);

  return (
    <Dialog open={open} onClose={onClose} title="اختيار العميل">
      <div className="space-y-3">
        <button
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-ink-300 p-3 text-start transition-colors hover:border-primary-400 hover:bg-primary-50"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-ink-100 text-ink-500">
            <UserRound className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-extrabold">زبون نقدي</span>
            <span className="block text-xs text-ink-500">بيع سريع بدون تسجيل عميل — يُدفع بالكامل</span>
          </span>
        </button>

        <Input placeholder="ابحث بالاسم، المحل، الهاتف..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />

        <div className="max-h-[45dvh] space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-ink-500">جارٍ البحث...</p>
          ) : customers.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">لا يوجد عملاء مطابقون</p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-primary-50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-extrabold text-primary-800">
                    {c.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{c.name}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {[c.shop_name, c.area].filter(Boolean).join(' — ') || c.phone}
                    </span>
                  </span>
                </span>
                {c.balance !== 0 ? (
                  <span className="text-end">
                    <Money value={c.balance} className="text-xs text-red-600" />
                    <span className="block text-[10px] text-ink-500">عليه</span>
                  </span>
                ) : (
                  <Users className="size-4 text-ink-300" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}
