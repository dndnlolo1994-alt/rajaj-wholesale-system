// تحويل Canvas أحادي اللون إلى أوامر ESC/POS (طباعة نقطية GS v 0)
// يعمل مع الغالبية الساحقة من الطابعات الحرارية بأي لغة — لأن الإيصال
// يُرسل كصورة مرسومة بمحرك نص المتصفح (تشكيل عربي مضمون).

export interface EscposOptions {
  cut: boolean;
  cashDrawer: boolean;
  copies: number;
}

export function canvasToEscpos(canvas: HTMLCanvasElement, opts: EscposOptions): Uint8Array {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const bytesPerRow = Math.ceil(width / 8);

  const mono = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
      if (lum < 160) {
        mono[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  const parts: number[] = [];
  const push = (...bytes: number[]) => parts.push(...bytes);

  push(0x1b, 0x40); // ESC @ init

  // GS v 0 — raster bit image (مقسّمة شرائح لتوافق الذواكر الصغيرة)
  const sliceRows = 128;
  for (let start = 0; start < height; start += sliceRows) {
    const rows = Math.min(sliceRows, height - start);
    push(0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff);
    for (let r = 0; r < rows; r++) {
      const offset = (start + r) * bytesPerRow;
      for (let b = 0; b < bytesPerRow; b++) parts.push(mono[offset + b]);
    }
  }

  push(0x1b, 0x64, 0x03); // ESC d 3 — تغذية 3 أسطر
  if (opts.cut) push(0x1d, 0x56, 0x42, 0x10); // GS V B — قص جزئي
  if (opts.cashDrawer) push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p — فتح الدرج

  const single = Uint8Array.from(parts);
  if (opts.copies <= 1) return single;

  const all = new Uint8Array(single.length * opts.copies);
  for (let c = 0; c < opts.copies; c++) all.set(single, c * single.length);
  return all;
}

export function toBase64(data: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** إرسال البيانات إلى جسر الطباعة المحلي */
export async function sendToBridge(params: {
  bridgeUrl: string;
  printerIp: string;
  printerPort: number;
  data: Uint8Array;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${params.bridgeUrl.replace(/\/$/, '')}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: params.printerIp,
        port: params.printerPort,
        data: toBase64(params.data),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `الجسر أعاد الحالة ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError'
      ? 'انتهت مهلة الاتصال بالطابعة'
      : 'تعذر الوصول لجسر الطباعة — تأكد أنه يعمل على هذا الجهاز';
    return { ok: false, error: msg };
  }
}

export async function checkBridge(bridgeUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${bridgeUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}
