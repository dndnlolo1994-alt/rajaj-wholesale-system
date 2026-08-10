'use client';

import { useEffect } from 'react';

/** تسجيل Service Worker لتثبيت النظام كتطبيق على الهاتف */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  return null;
}
