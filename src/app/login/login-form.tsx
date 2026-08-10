'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { loginAction } from './actions';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const [loginName, setLoginName] = useState('almasri');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await loginAction({ loginName: loginName.trim(), password });
    if (res.ok) {
      router.replace(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } else {
      setError(res.error.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="اسم المستخدم" required>
        <Input
          type="text"
          dir="ltr"
          autoComplete="username"
          required
          value={loginName}
          onChange={(e) => setLoginName(e.target.value)}
          placeholder="almasri"
          className="text-end"
        />
      </Field>
      <Field label="كلمة المرور" required>
        <Input
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="text-end"
        />
      </Field>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>
      ) : null}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        تسجيل الدخول
      </Button>
    </form>
  );
}
