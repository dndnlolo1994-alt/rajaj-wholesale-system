import { Store } from 'lucide-react';
import { LoginForm } from './login-form';

export const metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-primary-950 via-primary-900 to-primary-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-white/10 text-primary-200 shadow-pop">
            <Store className="size-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">نظام رجائي المصري</h1>
          <p className="mt-1 text-sm text-primary-300">إدارة التوزيع والجملة</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-pop">
          <LoginForm next={params.next} initialError={params.error === 'inactive' ? 'هذا الحساب موقوف. تواصل مع مدير النظام.' : undefined} />
        </div>
        <p className="mt-4 text-center text-xs text-primary-400">
          الدينار الأردني — توقيت عمّان
        </p>
      </div>
    </div>
  );
}
