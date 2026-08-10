import { Settings2 } from 'lucide-react';

export const metadata = { title: 'إكمال الإعداد' };

export default function SetupRequiredPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary-950 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-pop">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Settings2 className="size-7" />
        </div>
        <h1 className="text-xl font-extrabold text-ink-900">النظام يحتاج إكمال الإعداد</h1>
        <p className="mt-2 text-sm leading-7 text-ink-500">
          متغيرات البيئة الخاصة بـ Supabase غير مضبوطة. افتح ملف
          <code className="mx-1 rounded bg-ink-100 px-1.5 py-0.5 text-xs font-bold" dir="ltr">.env.local</code>
          وعبّئ القيم التالية من لوحة مشروعك (Settings → API):
        </p>
        <pre dir="ltr" className="mt-4 overflow-x-auto rounded-xl bg-ink-900 p-4 text-start text-xs leading-6 text-emerald-300">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}
        </pre>
        <p className="mt-4 text-sm leading-7 text-ink-500">
          ثم طبّق قاعدة البيانات وأنشئ حساب المالك:
        </p>
        <pre dir="ltr" className="mt-2 overflow-x-auto rounded-xl bg-ink-900 p-4 text-start text-xs leading-6 text-emerald-300">
{`npm run db:apply
npm run create-owner -- you@email.com YourPassword "رجائي المصري"`}
        </pre>
        <p className="mt-4 text-xs text-ink-500">التفاصيل الكاملة في ملف docs/SETUP.md</p>
      </div>
    </div>
  );
}
