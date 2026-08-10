import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildFullBackup, logBackup, notifyBackupFailure } from '@/lib/backup';
import { env } from '@/lib/env';

// نسخ احتياطي تلقائي يومي — يستدعيه Vercel Cron (انظر vercel.json)
// يرفع الملف إلى Supabase Storage (bucket: backups) ويحذف الأقدم من مدة الاحتفاظ.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const privateResponseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: privateResponseHeaders },
    );
  }
  if (!env.serviceRoleKey) {
    return NextResponse.json(
      { error: 'service key missing' },
      { status: 500, headers: privateResponseHeaders },
    );
  }

  try {
    const admin = createAdminClient();
    const backup = await buildFullBackup();
    const path = `auto/${backup.fileName}`;

    const { error: uploadError } = await admin.storage
      .from('backups')
      .upload(path, backup.json, { contentType: 'application/json', upsert: true });
    if (uploadError) throw new Error(`فشل رفع النسخة للتخزين: ${uploadError.message}`);

    await logBackup({
      type: 'auto',
      status: 'success',
      fileName: backup.fileName,
      fileSize: Buffer.byteLength(backup.json, 'utf8'),
      storagePath: path,
      tablesCount: backup.tablesCount,
      rowsCount: backup.rowsCount,
    });

    // حذف النسخ الأقدم من مدة الاحتفاظ
    const { data: settings } = await admin.from('app_settings').select('value').eq('key', 'backup').single();
    const retentionDays = Number((settings?.value as { retention_days?: number } | null)?.retention_days ?? 30);
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const { data: files } = await admin.storage.from('backups').list('auto', { limit: 200 });
    const old = (files ?? [])
      .filter((f) => f.created_at != null && new Date(f.created_at).getTime() < cutoff)
      .map((f) => `auto/${f.name}`);
    if (old.length > 0) await admin.storage.from('backups').remove(old);

    return NextResponse.json(
      { ok: true, file: path, rows: backup.rowsCount, cleaned: old.length },
      { headers: privateResponseHeaders },
    );
  } catch (e) {
    const message = (e as Error).message;
    await logBackup({ type: 'auto', status: 'failed', error: message }).catch(() => undefined);
    await notifyBackupFailure(message);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: privateResponseHeaders },
    );
  }
}
