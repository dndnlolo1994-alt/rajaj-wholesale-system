'use client';

// زر تصدير CSV — يفتح مسار التصدير في نافذة جديدة

import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ExportButton({ reportKey, from, to }: { reportKey: string; from: string; to: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open(`/api/export?report=${reportKey}&from=${from}&to=${to}`, '_blank', 'noopener')}
    >
      <FileDown className="size-4" />
      تصدير CSV
    </Button>
  );
}
