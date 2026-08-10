import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { buildFullBackup, logBackup } from '@/lib/backup';
import { buildFullReportPdf } from '@/lib/pdf/full-report';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const;

export async function GET() {
  const profile = await getProfile();
  if (!profile || !profile.is_active || !['owner', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: privateHeaders });
  }
  if (!env.serviceRoleKey) {
    return NextResponse.json(
      { error: 'خدمة إنشاء التقرير غير مضبوطة.' },
      { status: 500, headers: privateHeaders },
    );
  }

  try {
    const [backup, settings] = await Promise.all([buildFullBackup(), getSettings()]);
    const payload = JSON.parse(backup.json) as {
      exported_at: string;
      rows_count: number;
      tables_count: number;
      tables: Record<string, Record<string, unknown>[]>;
    };
    const report = await buildFullReportPdf(payload, settings.business.business_name);

    await logBackup({
      type: 'export',
      status: 'success',
      fileName: report.fileName,
      fileSize: report.buffer.byteLength,
      tablesCount: backup.tablesCount,
      rowsCount: backup.rowsCount,
      createdBy: profile.id,
    });

    return new NextResponse(new Uint8Array(report.buffer), {
      headers: {
        ...privateHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.fileName}"`,
        'Content-Length': String(report.buffer.byteLength),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر إنشاء التقرير.';
    await logBackup({ type: 'export', status: 'failed', error: message, createdBy: profile.id }).catch(() => undefined);
    return NextResponse.json(
      { error: 'تعذر إنشاء التقرير حاليًا. حاول مرة أخرى بعد قليل.' },
      { status: 500, headers: privateHeaders },
    );
  }
}
