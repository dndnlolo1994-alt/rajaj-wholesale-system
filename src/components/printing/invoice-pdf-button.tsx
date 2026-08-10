'use client';

import { useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InvoicePdfButton({
  id,
  invoiceNo,
  label = 'PDF / إرسال',
  variant = 'outline',
}: {
  id: string;
  invoiceNo?: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
}) {
  const [loading, setLoading] = useState(false);

  const openOrShare = async () => {
    const url = `/api/sales/${id}/pdf`;
    const fileName = `invoice-${invoiceNo ?? id}.pdf`;
    setLoading(true);
    try {
      if ('share' in navigator && 'canShare' in navigator && typeof File !== 'undefined') {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ title: invoiceNo ? `فاتورة ${invoiceNo}` : 'فاتورة PDF', files: [file] });
            return;
          }
        }
      }
      window.open(url, '_blank', 'noopener,width=900,height=720');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} onClick={openOrShare} loading={loading}>
      <FileText className="size-4" />
      {label}
      <Send className="size-3.5 opacity-70" />
    </Button>
  );
}
