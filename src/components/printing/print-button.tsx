'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** يفتح صفحة الطباعة في نافذة مستقلة (تقرأ إعدادات الطابعة من النظام) */
export function PrintButton({
  kind,
  id,
  query,
  label = 'طباعة',
  auto = true,
}: {
  kind: 'sale' | 'statement' | 'supplier-statement' | 'day' | 'count' | 'cash-session';
  id: string;
  query?: Record<string, string>;
  label?: string;
  auto?: boolean;
}) {
  const open = () => {
    const params = new URLSearchParams(query);
    if (auto) params.set('auto', '1');
    const qs = params.toString();
    window.open(`/print/${kind}/${id}${qs ? `?${qs}` : ''}`, '_blank', 'noopener,width=460,height=680');
  };

  return (
    <Button variant="outline" onClick={open}>
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
