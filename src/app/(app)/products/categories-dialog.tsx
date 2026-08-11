'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FolderTree, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { Category } from '@/lib/types/db';
import { matchCategoryIcon, matchCategoryColor } from '@/lib/product-icon-map';
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from '@/server/actions/products';

/** حوار إدارة الأقسام: إضافة + إعادة تسمية + حذف */
export function CategoriesDialog({ categories, canManage }: { categories: Category[]; canManage: boolean }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const add = async () => {
    const name = newName.trim();
    if (!name) {
      error('اكتب اسم القسم');
      return;
    }
    setAdding(true);
    const res = await createCategoryAction(name);
    setAdding(false);
    if (res.ok) {
      success('أُضيف القسم');
      setNewName('');
      router.refresh();
    } else {
      error('تعذر الإضافة', res.error.message);
    }
  };

  const rename = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      error('اكتب اسم القسم');
      return;
    }
    setSavingRename(true);
    const res = await renameCategoryAction(editingId, name);
    setSavingRename(false);
    if (res.ok) {
      success('تمت إعادة التسمية');
      setEditingId(null);
      router.refresh();
    } else {
      error('تعذر التعديل', res.error.message);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteCategoryAction(deleteTarget.id);
    setDeleting(false);
    if (res.ok) {
      success('حُذف القسم');
      setDeleteTarget(null);
      router.refresh();
    } else {
      setDeleteTarget(null);
      error('تعذر الحذف', res.error.message);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FolderTree className="size-4" />
        الأقسام
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="إدارة الأقسام">
        {canManage ? (
          <div className="mb-3 flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم قسم جديد..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button onClick={add} loading={adding} className="shrink-0">
              <Plus className="size-4" />
              إضافة
            </Button>
          </div>
        ) : null}

        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">لا توجد أقسام بعد</p>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                {editingId === c.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="h-9"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          rename();
                        }
                      }}
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" onClick={rename} loading={savingRename}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={savingRename}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-2">
                      {(() => {
                        const iconSrc = matchCategoryIcon(c.name);
                        const colors = matchCategoryColor(c.name);
                        return iconSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                            style={colors ? { backgroundColor: colors.bg } : undefined}
                          >
                            <img src={iconSrc} alt="" className="size-5" aria-hidden="true" />
                          </span>
                        ) : null;
                      })()}
                      <span className="text-sm font-bold text-ink-900">{c.name}</span>
                    </span>
                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditName(c.name);
                          }}
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                          aria-label="إعادة تسمية"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                          aria-label="حذف"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {!canManage ? (
          <p className="mt-3 text-xs text-ink-500">إدارة الأقسام متاحة للمالك والمدير فقط.</p>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="حذف القسم"
        message={`سيُحذف القسم «${deleteTarget?.name ?? ''}» نهائيًا. لا يمكن حذف قسم مرتبط بأصناف.`}
        confirmLabel="حذف"
        danger
        loading={deleting}
      />
    </>
  );
}
