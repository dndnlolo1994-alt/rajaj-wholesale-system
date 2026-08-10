import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// النسخ الاحتياطي: تصدير كل الجداول إلى JSON واحد منظم.
// يعمل بمفتاح الخدمة (يتجاوز RLS) — يُستدعى فقط من مسارات محمية.

export const BACKUP_TABLES = [
  'profiles', 'app_settings', 'counters', 'categories', 'products',
  'customers', 'suppliers', 'customer_prices',
  'sales', 'sale_items', 'held_sales',
  'purchases', 'purchase_items',
  'payments', 'customer_ledger', 'supplier_ledger',
  'stock_movements', 'returns', 'return_items',
  'expense_categories', 'expenses',
  'cash_transactions', 'cash_sessions',
  'inventory_counts', 'inventory_count_items',
  'notes', 'notifications', 'audit_logs', 'backup_logs',
] as const;

export interface BackupResult {
  json: string;
  tablesCount: number;
  rowsCount: number;
  fileName: string;
}

export async function buildFullBackup(): Promise<BackupResult> {
  const admin = createAdminClient();
  const tables: Record<string, unknown[]> = {};
  let rowsCount = 0;

  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    const pageSize = 1000;
    for (let fromRow = 0; ; fromRow += pageSize) {
      const { data, error } = await admin
        .from(table)
        .select('*')
        .range(fromRow, fromRow + pageSize - 1);
      if (error) throw new Error(`فشل تصدير جدول ${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    tables[table] = rows;
    rowsCount += rows.length;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const payload = {
    system: 'rajaei-wholesale-system',
    version: 1,
    exported_at: new Date().toISOString(),
    tables_count: BACKUP_TABLES.length,
    rows_count: rowsCount,
    tables,
  };

  return {
    json: JSON.stringify(payload),
    tablesCount: BACKUP_TABLES.length,
    rowsCount,
    fileName: `rajaei-backup-${stamp}.json`,
  };
}

/** تسجيل عملية نسخ في السجل */
export async function logBackup(params: {
  type: 'manual' | 'auto' | 'export';
  status: 'success' | 'failed';
  fileName?: string;
  fileSize?: number;
  storagePath?: string;
  tablesCount?: number;
  rowsCount?: number;
  error?: string;
  createdBy?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from('backup_logs').insert({
    backup_type: params.type,
    status: params.status,
    file_name: params.fileName ?? null,
    file_size: params.fileSize ?? null,
    storage_path: params.storagePath ?? null,
    tables_count: params.tablesCount ?? null,
    rows_count: params.rowsCount ?? null,
    error: params.error ?? null,
    finished_at: new Date().toISOString(),
    created_by: params.createdBy ?? null,
  });
}

export async function notifyBackupFailure(message: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('notifications').insert({
      type: 'backup_failed',
      severity: 'critical',
      title: 'فشل النسخ الاحتياطي',
      body: message,
      dedupe_key: `backup_failed:${new Date().toISOString().slice(0, 10)}`,
    });
  } catch {
    // لا شيء إضافي يمكن فعله
  }
}
