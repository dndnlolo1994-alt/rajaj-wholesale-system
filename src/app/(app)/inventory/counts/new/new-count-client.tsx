'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Select, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import type { Category, CountType } from '@/lib/types/db';
import { startCountAction } from '@/server/actions/products';

/** نموذج بدء جلسة جرد جديدة */
export function NewCountClient({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [countType, setCountType] = useState<CountType>('manual');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [starting, setStarting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const start = async () => {
    setStarting(true);
    setErrMsg(null);
    const res = await startCountAction({
      count_type: countType,
      category_id: categoryId || null,
      notes: notes.trim() || null,
    });
    if (res.ok) {
      success(`فُتحت جلسة الجرد ${res.data.count_no}`, `${res.data.items_total} صنف للعد`);
      router.push(`/inventory/counts/${res.data.id}`);
      router.refresh();
    } else {
      setStarting(false);
      setErrMsg(res.error.message);
      error('تعذر فتح الجلسة', res.error.message);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          لا يمكن فتح أكثر من جلسة جرد في الوقت نفسه — أغلق الجلسة المفتوحة أو ألغِها أولًا.
        </div>

        <Field label="نوع الجرد" required>
          <Segmented
            value={countType}
            onChange={setCountType}
            options={[
              { value: 'daily', label: 'يومي' },
              { value: 'monthly', label: 'شهري' },
              { value: 'manual', label: 'يدوي' },
            ]}
          />
        </Field>

        <Field label="القسم" hint="اختياري: اتركه فارغًا لجرد كل الأصناف الفعالة">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">كل الأقسام</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="ملاحظات">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: جرد نهاية الشهر..." />
        </Field>

        {errMsg ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm font-bold text-red-700">{errMsg}</p>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={start} loading={starting} size="lg">
            <ClipboardCheck className="size-5" />
            بدء الجرد
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
