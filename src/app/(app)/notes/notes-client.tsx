'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, ListTodo, Pencil, Pin, PinOff, StickyNote, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime } from '@/lib/format/date';
import type { Note } from '@/lib/types/db';
import { createNoteAction, deleteNoteAction, toggleNoteAction, updateNoteAction } from '@/server/actions/notes';

export interface NoteRow extends Note {
  creator: { full_name: string } | null;
}

export function NotesClient({ rows }: { rows: NoteRow[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [content, setContent] = useState('');
  const [isTask, setIsTask] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) {
      error('اكتب الملاحظة أولًا');
      return;
    }
    setSaving(true);
    const res = await createNoteAction({ content: content.trim(), is_task: isTask, is_pinned: isPinned });
    setSaving(false);
    if (res.ok) {
      success('حُفظت الملاحظة');
      setContent('');
      setIsTask(false);
      setIsPinned(false);
      router.refresh();
    } else {
      error('تعذر الحفظ', res.error.message);
    }
  };

  // تجميع متتابع حسب اليوم (المثبتة تبقى أولًا حسب ترتيب الخادم)
  const groups: { title: string; notes: NoteRow[] }[] = [];
  for (const n of rows) {
    const title = fmtDate(n.note_date);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.notes.push(n);
    else groups.push({ title, notes: [n] });
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <Textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="اكتب ملاحظة اليوم..."
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-700">
              <input
                type="checkbox"
                checked={isTask}
                onChange={(e) => setIsTask(e.target.checked)}
                className="size-4 accent-primary-700"
              />
              مهمة
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-700">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="size-4 accent-primary-700"
              />
              مثبتة
            </label>
          </div>
          <Button onClick={save} loading={saving}>
            حفظ الملاحظة
          </Button>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="لا ملاحظات بعد" description="اكتب أول ملاحظة في دفترك اليومي" />
        </Card>
      ) : (
        groups.map((g, i) => (
          <div key={`${g.title}-${i}`}>
            <h2 className="mb-2 text-sm font-extrabold text-ink-500">{g.title}</h2>
            <div className="space-y-2">
              {g.notes.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function NoteCard({ note }: { note: NoteRow }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggle = async (field: 'is_done' | 'is_pinned' | 'is_task', value: boolean, msg: string) => {
    setBusy(true);
    const res = await toggleNoteAction(note.id, field, value);
    setBusy(false);
    if (res.ok) {
      success(msg);
      router.refresh();
    } else {
      error('تعذر التعديل', res.error.message);
    }
  };

  const saveEdit = async () => {
    if (!draft.trim()) {
      error('اكتب الملاحظة');
      return;
    }
    setBusy(true);
    const res = await updateNoteAction(note.id, draft.trim());
    setBusy(false);
    if (res.ok) {
      success('عُدّلت الملاحظة');
      setEditing(false);
      router.refresh();
    } else {
      error('تعذر التعديل', res.error.message);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    const res = await deleteNoteAction(note.id);
    setDeleting(false);
    if (res.ok) {
      success('حُذفت الملاحظة');
      setConfirmDelete(false);
      router.refresh();
    } else {
      error('تعذر الحذف', res.error.message);
    }
  };

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        {note.is_task ? (
          <button
            type="button"
            onClick={() => toggle('is_done', !note.is_done, note.is_done ? 'أُعيدت المهمة' : 'أُنجزت المهمة ✓')}
            disabled={busy}
            className="mt-0.5 shrink-0 transition-colors"
            aria-label={note.is_done ? 'إعادة فتح المهمة' : 'إنجاز المهمة'}
            title={note.is_done ? 'إعادة فتح المهمة' : 'إنجاز المهمة'}
          >
            {note.is_done ? (
              <CheckCircle2 className="size-6 text-emerald-600" />
            ) : (
              <Circle className="size-6 text-ink-300 hover:text-primary-600" />
            )}
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          {editing ? (
            <div>
              <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={saveEdit} loading={busy}>
                  حفظ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setDraft(note.content);
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <p
              className={cn(
                'whitespace-pre-wrap text-sm leading-6 text-ink-900',
                note.is_task && note.is_done && 'text-ink-400 line-through',
              )}
            >
              {note.content}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span className="font-bold">{note.creator?.full_name ?? '—'}</span>
            <span>{fmtTime(note.created_at)}</span>
            {note.is_pinned ? (
              <Badge tone="warning">
                <Pin className="size-3" />
                مثبتة
              </Badge>
            ) : null}
            {note.is_task ? (
              <Badge tone={note.is_done ? 'success' : 'info'}>{note.is_done ? 'مهمة منجزة' : 'مهمة'}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn
            title={note.is_pinned ? 'إلغاء التثبيت' : 'تثبيت'}
            onClick={() => toggle('is_pinned', !note.is_pinned, note.is_pinned ? 'أُلغي التثبيت' : 'ثُبّتت الملاحظة')}
          >
            {note.is_pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </IconBtn>
          <IconBtn
            title={note.is_task ? 'تحويل لملاحظة' : 'تحويل لمهمة'}
            onClick={() => toggle('is_task', !note.is_task, note.is_task ? 'حُوّلت لملاحظة' : 'حُوّلت لمهمة')}
          >
            {note.is_task ? <StickyNote className="size-4" /> : <ListTodo className="size-4" />}
          </IconBtn>
          <IconBtn title="تعديل" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </IconBtn>
          <IconBtn title="حذف" danger onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="حذف الملاحظة"
        message="سيتم حذف الملاحظة نهائيًا. متابعة؟"
        confirmLabel="حذف"
        danger
        loading={deleting}
      />
    </Card>
  );
}

function IconBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'rounded-lg p-1.5 transition-colors',
        danger ? 'text-red-500 hover:bg-red-50' : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700',
      )}
    >
      {children}
    </button>
  );
}
