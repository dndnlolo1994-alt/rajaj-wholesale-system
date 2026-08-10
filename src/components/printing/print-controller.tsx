'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Printer, RefreshCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReceiptBlock } from '@/lib/printing/receipt-model';
import { renderReceiptToCanvas } from '@/lib/printing/receipt-canvas';
import { canvasToEscpos, sendToBridge } from '@/lib/printing/escpos';
import type { PrinterSettings } from '@/lib/settings-shared';

/**
 * شريط تحكم صفحة الطباعة:
 * - وضع المتصفح: window.print() (حوار الطباعة القياسي)
 * - وضع الجسر: تصيير Canvas → ESC/POS → إرسال صامت للطابعة الشبكية
 * ?auto=1 يطبع فورًا عند الفتح.
 */
export function PrintController({
  blocks,
  settings,
  auto,
  pdfUrl,
}: {
  blocks: ReceiptBlock[];
  settings: PrinterSettings;
  auto: boolean;
  pdfUrl?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const fired = useRef(false);

  const printBrowser = useCallback(() => {
    window.print();
  }, []);

  const printBridge = useCallback(async () => {
    if (!settings.printer_ip) {
      setStatus('error');
      setMessage('لم يتم ضبط IP الطابعة — افتح إعدادات الطابعة');
      return;
    }
    setStatus('sending');
    setMessage(null);
    try {
      await document.fonts.ready;
      const canvas = renderReceiptToCanvas(blocks, settings.paper_width);
      const data = canvasToEscpos(canvas, {
        cut: settings.cut,
        cashDrawer: settings.cash_drawer,
        copies: Math.max(1, settings.copies),
      });
      const res = await sendToBridge({
        bridgeUrl: settings.bridge_url,
        printerIp: settings.printer_ip,
        printerPort: settings.printer_port,
        data,
      });
      if (res.ok) {
        setStatus('sent');
        setMessage('أُرسلت للطابعة ✓');
      } else {
        setStatus('error');
        setMessage(res.error ?? 'فشل الإرسال');
      }
    } catch {
      setStatus('error');
      setMessage('تعذر تجهيز الإيصال للطباعة');
    }
  }, [blocks, settings]);

  const doPrint = useCallback(() => {
    if (settings.mode === 'bridge') printBridge();
    else printBrowser();
  }, [settings.mode, printBridge, printBrowser]);

  useEffect(() => {
    if (auto && !fired.current) {
      fired.current = true;
      const t = setTimeout(doPrint, 450);
      return () => clearTimeout(t);
    }
  }, [auto, doPrint]);

  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white p-3 shadow-card">
      <Button onClick={doPrint} loading={status === 'sending'}>
        <Printer className="size-4" />
        {settings.mode === 'bridge' ? 'طباعة مباشرة للطابعة' : 'طباعة من الهاتف'}
      </Button>
      {settings.mode === 'bridge' ? (
        <Button variant="outline" onClick={printBrowser}>
          طباعة من الهاتف / المتصفح
        </Button>
      ) : null}
      {pdfUrl ? (
        <Button variant="secondary" onClick={() => window.open(pdfUrl, '_blank', 'noopener,width=900,height=720')}>
          <FileText className="size-4" />
          PDF / إرسال
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => (status === 'sent' || status === 'error' ? doPrint() : window.print())}>
        <RefreshCcw className="size-4" />
        إعادة طباعة
      </Button>
      <Button variant="ghost" onClick={() => window.close()}>
        <X className="size-4" />
        إغلاق
      </Button>
      {message ? (
        <p className={`w-full text-xs font-bold ${status === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{message}</p>
      ) : null}
    </div>
  );
}
