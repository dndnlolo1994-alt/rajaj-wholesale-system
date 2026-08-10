import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { buildFullBackup, logBackup } from '@/lib/backup';
import { env } from '@/lib/env';

// تنزيل نسخة احتياطية JSON كاملة يدويًا — للمالك والمدير فقط

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  const profile = await getProfile();
  if (!profile || !profile.is_active || !['owner', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!env.serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط — النسخ الاحتياطي يحتاجه' },
      { status: 500 },
    );
  }

  try {
    const backup = await buildFullBackup();
    await logBackup({
      type: 'export',
      status: 'success',
      fileName: backup.fileName,
      fileSize: Buffer.byteLength(backup.json, 'utf8'),
      tablesCount: backup.tablesCount,
      rowsCount: backup.rowsCount,
      createdBy: profile.id,
    });
    return new NextResponse(backup.json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${backup.fileName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const message = (e as Error).message;
    await logBackup({ type: 'export', status: 'failed', error: message, createdBy: profile.id }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
