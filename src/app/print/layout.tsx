// تخطيط صفحات الطباعة — بدون واجهة النظام، خلفية رمادية للمعاينة فقط
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-100 p-3 print:bg-white print:p-0">
      <div className="mx-auto max-w-md print:max-w-none">{children}</div>
      <style>{`
        @media print {
          @page { size: auto; margin: 0; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
