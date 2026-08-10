import type { Metadata, Viewport } from 'next';
import { Cairo } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'نظام رجائي المصري',
    template: '%s | نظام رجائي المصري',
  },
  description: 'نظام إدارة التوزيع والجملة — رجائي المصري',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'رجائي المصري',
  },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/icon-192.png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#1d6450',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
