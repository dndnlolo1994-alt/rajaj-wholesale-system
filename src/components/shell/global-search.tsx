'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Building2, Loader2, ReceiptText, Search, Users, X } from 'lucide-react';
import { globalSearchAction, type GlobalSearchResults } from '@/server/actions/search';
import { formatJOD } from '@/lib/calc/money';
import { formatQty } from '@/lib/calc/units';

export function GlobalSearch({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // اختصار Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onOpen]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ('');
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 1) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const res = await globalSearchAction(q.trim());
      setLoading(false);
      if (res.ok) setResults(res.data);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, open]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const empty =
    results &&
    results.customers.length === 0 &&
    results.suppliers.length === 0 &&
    results.products.length === 0 &&
    results.sales.length === 0;

  return (
    <div className="fixed inset-0 z-[85]">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-pop absolute inset-x-3 top-4 mx-auto max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop sm:top-16">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4">
          {loading ? <Loader2 className="size-5 animate-spin text-primary-600" /> : <Search className="size-5 text-ink-500" />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن عميل، مورد، صنف، باركود، رقم فاتورة، هاتف..."
            className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-ink-500/60"
          />
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[65dvh] overflow-y-auto p-2">
          {!results && !loading ? (
            <p className="px-3 py-8 text-center text-sm text-ink-500">اكتب للبحث في كل النظام</p>
          ) : null}
          {empty ? <p className="px-3 py-8 text-center text-sm text-ink-500">لا توجد نتائج لـ «{q}»</p> : null}

          {results?.customers.length ? (
            <ResultGroup title="العملاء" icon={<Users className="size-4" />}>
              {results.customers.map((c) => (
                <ResultRow
                  key={c.id}
                  onClick={() => go(`/customers/${c.id}`)}
                  title={c.name}
                  sub={[c.shop_name, c.phone].filter(Boolean).join(' — ')}
                  meta={c.balance !== 0 ? `الرصيد ${formatJOD(c.balance)}` : undefined}
                />
              ))}
            </ResultGroup>
          ) : null}

          {results?.products.length ? (
            <ResultGroup title="الأصناف" icon={<Boxes className="size-4" />}>
              {results.products.map((p) => (
                <ResultRow
                  key={p.id}
                  onClick={() => go(`/products/${p.id}`)}
                  title={p.name}
                  sub={p.barcode ?? undefined}
                  meta={`${formatQty(p.stock_units, p.units_per_carton)} — كرتونة ${formatJOD(p.sale_price_carton)}`}
                />
              ))}
            </ResultGroup>
          ) : null}

          {results?.suppliers.length ? (
            <ResultGroup title="الموردون" icon={<Building2 className="size-4" />}>
              {results.suppliers.map((s) => (
                <ResultRow
                  key={s.id}
                  onClick={() => go(`/suppliers/${s.id}`)}
                  title={s.name}
                  sub={[s.company_name, s.phone].filter(Boolean).join(' — ')}
                  meta={s.balance !== 0 ? `له ${formatJOD(s.balance)}` : undefined}
                />
              ))}
            </ResultGroup>
          ) : null}

          {results?.sales.length ? (
            <ResultGroup title="الفواتير" icon={<ReceiptText className="size-4" />}>
              {results.sales.map((s) => (
                <ResultRow
                  key={s.id}
                  onClick={() => go(`/sales/${s.id}`)}
                  title={s.invoice_no}
                  sub={s.customer_name}
                  meta={formatJOD(s.total)}
                />
              ))}
            </ResultGroup>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-bold text-ink-500">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function ResultRow({
  title,
  sub,
  meta,
  onClick,
}: {
  title: string;
  sub?: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-primary-50"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-ink-900">{title}</span>
        {sub ? <span className="block truncate text-xs text-ink-500">{sub}</span> : null}
      </span>
      {meta ? <span className="tnum shrink-0 text-xs font-bold text-ink-700">{meta}</span> : null}
    </button>
  );
}
