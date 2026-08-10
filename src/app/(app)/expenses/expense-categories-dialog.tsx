'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FolderCog, Pencil, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import type { ExpenseCategory } from '@/lib/types/db';
import {
  createExpenseCategoryAction,
  renameExpenseCategoryAction,
  toggleExpenseCategoryAction,
} from '@/server/actions/expenses';

/** حوار إدارة تصنيفات المصروفات: إضافة/إعادة تسمية/تفعيل-إيقاف */
export function ExpenseCategoriesDialog({ categories }: { categories: ExpenseCategory[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async () => {
    if (!newName.trim()) {
      error('اكتب اسم التصنيف');
      return;
    }
    setAdding(true);
    const res = await createExpenseCategoryAction(newName.trim());
    setAdding(false);
    if (res.ok) {
      success('أُضيف التصنيف');
      setNewName('');
      router.refresh();
    } else {
      error('تعذر إضافة التصنيف', res.error.message);
    }
  };

  const rename = async (id: string) => {
    if (!editName.trim()) {
      error('اكتب اسم التصنيف');
      return;
    }
    setBusyId(id);
    const res = await renameExpenseCategoryAction(id, editName.trim());
    setBusyId(null);
    if (res.ok) {
      success('تم تعديل الاسم');
      setEditingId(null);
      router.refresh();
    } else {
      error('تعذر التعديل', res.error.message);
    }
  };

  const toggle = async (c: ExpenseCategory) => {
    setBusyId(c.id);
    const res = await toggleExpenseCategoryAction(c.id, !c.is_active);
    setBusyId(null);
    if (res.ok) {
      success(c.is_active ? 'أُوقف التصنيف' : 'فُعّل التصنيف');
      router.refresh();
    } else {
      error('تعذر تغيير الحالة', res.error.message);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FolderCog className="size-4" />
        التصنيفات
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="تصنيفات المصروفات">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="اسم تصنيف جديد..."
            />
            <Button onClick={add} loading={adding} className="shrink-0">
              إضافة
            </Button>
          </div>

          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">لا توجد تصنيفات بعد</p>
          ) : (
            <div className="divide-y divide-ink-100 rounded-xl border border-ink-200">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                  {editingId === c.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            rename(c.id);
                          }
                        }}
                        autoFocus
                        className="h-9"
                      />
                      <Button size="sm" onClick={() => rename(c.id)} loading={busyId === c.id} className="shrink-0">
                        <Check className="size-4" />
                        حفظ
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="shrink-0">
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-sm font-bold ${c.is_active ? 'text-ink-900' : 'text-ink-400'}`}>
                        {c.name}
                      </span>
                      {!c.is_active ? <Badge tone="muted">موقوف</Badge> : null}
                      <button
                        type="button"
                        title="إعادة تسمية"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                        }}
                        className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <Button
                        size="sm"
                        variant={c.is_active ? 'outline' : 'secondary'}
                        onClick={() => toggle(c)}
                        loading={busyId === c.id}
                        className="shrink-0"
                      >
                        {c.is_active ? 'إيقاف' : 'تفعيل'}
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
