'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ScanLine } from 'lucide-react';

// ماسح باركود بالكاميرا:
// يستخدم BarcodeDetector الأصلي عند توفره (كروم/أندرويد)،
// ومع غيابه يتحول إلى مكتبة ZXing (تُحمَّل عند الحاجة فقط).

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => DetectorLike;
  }
}

export function ScannerDialog({
  open,
  onClose,
  onDetect,
  continuous = false,
}: {
  open: boolean;
  onClose: () => void;
  /** يُستدعى عند قراءة باركود. أعد true لإغلاق الماسح. */
  onDetect: (code: string) => boolean | void;
  continuous?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const stopRef = useRef<() => void>(() => undefined);
  const recentRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setLastCode(null);
    recentRef.current.clear();

    const beep = () => {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 1800;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
        osc.onended = () => ctx.close();
      } catch {
        // الصوت اختياري
      }
    };

    const handleCode = (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      const last = recentRef.current.get(code) ?? 0;
      if (now - last < 2500) return; // منع التكرار المتلاحق لنفس الكود
      recentRef.current.set(code, now);
      beep();
      setLastCode(code);
      const shouldClose = onDetect(code);
      if (shouldClose === true || !continuous) onClose();
    };

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code'],
          });
          const interval = setInterval(async () => {
            if (cancelled || video.readyState < 2) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) handleCode(codes[0].rawValue);
            } catch {
              // تجاهل أخطاء إطار واحد
            }
          }, 180);
          stopRef.current = () => {
            clearInterval(interval);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromVideoElement(video, (result) => {
            if (result) handleCode(result.getText());
          });
          stopRef.current = () => {
            controls.stop();
            stream.getTracks().forEach((t) => t.stop());
          };
        }
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === 'NotAllowedError'
            ? 'تم رفض إذن الكاميرا. فعّله من إعدادات المتصفح.'
            : name === 'NotFoundError'
              ? 'لا توجد كاميرا متاحة على هذا الجهاز.'
              : 'تعذر تشغيل الكاميرا.',
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      stopRef.current();
      stopRef.current = () => undefined;
    };
  }, [open, onClose, onDetect, continuous]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[88] flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <p className="flex items-center gap-2 text-sm font-bold">
          <ScanLine className="size-5" />
          وجّه الكاميرا نحو الباركود
        </p>
        <button onClick={onClose} className="rounded-lg bg-white/10 p-2" aria-label="إغلاق">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {/* الفيديو */}
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        {/* إطار التصويب */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-72 max-w-[80vw] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error ? (
          <div className="absolute inset-x-4 bottom-6 rounded-xl bg-red-600 p-3 text-center text-sm font-bold text-white">
            {error}
          </div>
        ) : lastCode ? (
          <div className="absolute inset-x-4 bottom-6 rounded-xl bg-primary-700 p-3 text-center text-sm font-bold text-white" dir="ltr">
            ✓ {lastCode}
          </div>
        ) : null}
      </div>
      {continuous ? (
        <p className="bg-black p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-center text-xs text-white/70">
          الوضع المتواصل: امسح عدة منتجات ثم أغلق
        </p>
      ) : null}
    </div>
  );
}
