import type { ReceiptBlock } from '@/lib/printing/receipt-model';

// مُصيّر DOM للإيصال الحراري — متوافق مع طابعات 80mm و58mm
// المساحة القابلة للطباعة: 72mm أو 48mm تقريبًا

const sizeMap = { xl: 'text-[15px]', lg: 'text-[13px]', md: 'text-[12px]', sm: 'text-[10.5px]' } as const;

export function ReceiptView({ blocks, width }: { blocks: ReceiptBlock[]; width: 58 | 80 }) {
  return (
    <div
      id="receipt-root"
      dir="rtl"
      className="mx-auto bg-white text-black"
      style={{
        width: width === 80 ? '72mm' : '48mm',
        fontFamily: 'var(--font-cairo), "Segoe UI", Tahoma, sans-serif',
        lineHeight: 1.55,
      }}
    >
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'text':
            return (
              <p
                key={i}
                className={`${sizeMap[block.size ?? 'md']} ${block.bold ? 'font-extrabold' : 'font-medium'}`}
                style={{ textAlign: block.align === 'center' ? 'center' : block.align === 'end' ? 'left' : 'right' }}
              >
                {block.text}
              </p>
            );
          case 'row':
            return (
              <div key={i} className="flex items-start gap-1">
                {block.cols.map((col, j) => (
                  <span
                    key={j}
                    className={`${col.sm ? 'text-[10.5px]' : 'text-[12px]'} ${col.bold ? 'font-extrabold' : 'font-medium'} min-w-0 break-words`}
                    style={{
                      flexGrow: col.grow ?? 1,
                      flexBasis: 0,
                      textAlign: col.align === 'center' ? 'center' : col.align === 'end' ? 'left' : 'right',
                    }}
                  >
                    {col.text}
                  </span>
                ))}
              </div>
            );
          case 'sep':
            return (
              <div
                key={i}
                className="my-1"
                style={{ borderTop: block.style === 'solid' ? '1.5px solid #000' : '1px dashed #000' }}
              />
            );
          case 'space':
            return <div key={i} className="h-2" />;
          case 'kv':
            return (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className={`${block.lg ? 'text-[13px]' : 'text-[11px]'} ${block.bold ? 'font-extrabold' : 'font-medium'}`}>
                  {block.label}
                </span>
                <span dir="ltr" className={`${block.lg ? 'text-[14px]' : 'text-[11.5px]'} ${block.bold ? 'font-extrabold' : 'font-bold'} tnum`}>
                  {block.value}
                </span>
              </div>
            );
        }
      })}
    </div>
  );
}
