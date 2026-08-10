import type { ReceiptBlock } from './receipt-model';

// مُصيّر Canvas للإيصال — يرسم النص العربي عبر محرك المتصفح
// (تشكيل الحروف صحيح دائمًا) ثم يُحوَّل لاحقًا إلى ESC/POS Raster.
// 80mm → 576 بكسل، 58mm → 384 بكسل (كثافة 203dpi القياسية)

const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';

const sizePx = { xl: 30, lg: 26, md: 23, sm: 20 } as const;

export function renderReceiptToCanvas(blocks: ReceiptBlock[], paperWidth: 58 | 80): HTMLCanvasElement {
  const width = paperWidth === 80 ? 576 : 384;
  const pad = 8;
  const innerW = width - pad * 2;

  // تمريرة أولى لحساب الارتفاع
  const measure = document.createElement('canvas');
  const mctx = measure.getContext('2d')!;
  let height = pad;
  const layout: { y: number; h: number }[] = [];

  const lineHeight = (px: number) => Math.round(px * 1.5);

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxW || !current) {
        current = test;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };

  for (const block of blocks) {
    const y = height;
    let h = 0;
    switch (block.type) {
      case 'text': {
        const px = sizePx[block.size ?? 'md'];
        mctx.font = `${block.bold ? '800' : '500'} ${px}px ${FONT}`;
        h = wrapText(mctx, block.text, innerW).length * lineHeight(px);
        break;
      }
      case 'row': {
        const px = 20;
        mctx.font = `500 ${px}px ${FONT}`;
        let maxLines = 1;
        const total = block.cols.reduce((a, c) => a + (c.grow ?? 1), 0);
        for (const col of block.cols) {
          const w = (innerW - (block.cols.length - 1) * 6) * ((col.grow ?? 1) / total);
          maxLines = Math.max(maxLines, wrapText(mctx, col.text, w).length);
        }
        h = maxLines * lineHeight(px);
        break;
      }
      case 'sep':
        h = 14;
        break;
      case 'space':
        h = 12;
        break;
      case 'kv':
        h = lineHeight(block.lg ? 26 : 21);
        break;
    }
    layout.push({ y, h });
    height += h;
  }
  height += pad + 8;

  // الرسم الفعلي
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.direction = 'rtl';

  blocks.forEach((block, i) => {
    const { y } = layout[i];
    switch (block.type) {
      case 'text': {
        const px = sizePx[block.size ?? 'md'];
        ctx.font = `${block.bold ? '800' : '500'} ${px}px ${FONT}`;
        const lines = wrapText(ctx, block.text, innerW);
        lines.forEach((line, li) => {
          const ly = y + li * lineHeight(px);
          if (block.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(line, width / 2, ly);
          } else if (block.align === 'end') {
            ctx.textAlign = 'left';
            ctx.fillText(line, pad, ly);
          } else {
            ctx.textAlign = 'right';
            ctx.fillText(line, width - pad, ly);
          }
        });
        break;
      }
      case 'row': {
        const px = 20;
        const gap = 6;
        const total = block.cols.reduce((a, c) => a + (c.grow ?? 1), 0);
        // RTL: العمود الأول يبدأ من اليمين
        let xEnd = width - pad;
        for (const col of block.cols) {
          const w = (innerW - (block.cols.length - 1) * gap) * ((col.grow ?? 1) / total);
          ctx.font = `${col.bold ? '800' : '500'} ${px}px ${FONT}`;
          const lines = wrapText(ctx, col.text, w);
          lines.forEach((line, li) => {
            const ly = y + li * lineHeight(px);
            if (col.align === 'center') {
              ctx.textAlign = 'center';
              ctx.fillText(line, xEnd - w / 2, ly);
            } else if (col.align === 'end') {
              ctx.textAlign = 'left';
              ctx.fillText(line, xEnd - w, ly);
            } else {
              ctx.textAlign = 'right';
              ctx.fillText(line, xEnd, ly);
            }
          });
          xEnd -= w + gap;
        }
        break;
      }
      case 'sep': {
        const midY = y + 6;
        if (block.style === 'solid') {
          ctx.fillRect(pad, midY, innerW, 2);
        } else {
          for (let x = pad; x < width - pad; x += 10) {
            ctx.fillRect(x, midY, 5, 1.5);
          }
        }
        break;
      }
      case 'kv': {
        const px = block.lg ? 26 : 21;
        ctx.font = `${block.bold ? '800' : '600'} ${px}px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(block.label, width - pad, y);
        ctx.textAlign = 'left';
        ctx.direction = 'ltr';
        ctx.fillText(block.value, pad, y);
        ctx.direction = 'rtl';
        break;
      }
    }
  });

  return canvas;
}
