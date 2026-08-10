'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AuditLog } from '@/lib/types/db';

/** صف سجل تدقيق قابل للتوسيع لعرض البيانات قبل/بعد */
export function AuditRowDetails({
  log,
  actionLabel,
  dateText,
}: {
  log: AuditLog;
  actionLabel: string;
  dateText: string;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = log.before_data != null || log.after_data != null;
  const isDanger = log.action.includes('void') || log.action.includes('delete') || log.action.includes('failed') || log.action === 'system.reset';

  return (
    <div>
      <button
        onClick={() => hasDetails && setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-ink-100/50"
      >
        <div className="min-w-0">
          <p className="text-sm">
            <span className={`font-extrabold ${isDanger ? 'text-red-700' : 'text-ink-900'}`}>{actionLabel}</span>
            {log.entity_id ? <span className="tnum ms-2 text-xs text-ink-500" dir="ltr">{log.entity_id.slice(0, 24)}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {log.user_name ?? 'النظام'} — {dateText}
            {log.ip ? <span dir="ltr" className="tnum"> — {log.ip}</span> : null}
          </p>
        </div>
        {hasDetails ? (
          <ChevronDown className={`size-4 shrink-0 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        ) : null}
      </button>
      {open && hasDetails ? (
        <div className="grid gap-2 border-t border-dashed border-ink-200 bg-ink-100/40 p-3 lg:grid-cols-2">
          {log.before_data != null ? (
            <div>
              <p className="mb-1 text-[11px] font-bold text-ink-500">قبل التعديل</p>
              <pre dir="ltr" className="max-h-64 overflow-auto rounded-lg bg-white p-2 text-[11px] leading-5">
                {JSON.stringify(log.before_data, null, 2)}
              </pre>
            </div>
          ) : null}
          {log.after_data != null ? (
            <div>
              <p className="mb-1 text-[11px] font-bold text-ink-500">بعد التعديل</p>
              <pre dir="ltr" className="max-h-64 overflow-auto rounded-lg bg-white p-2 text-[11px] leading-5">
                {JSON.stringify(log.after_data, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
