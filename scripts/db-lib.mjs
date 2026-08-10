// أدوات الاتصال بقاعدة بيانات Supabase من السكربتات المحلية
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const POOLER_REGIONS = [
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'sa-east-1',
];

export function getDbConfig() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('✗ SUPABASE_DB_URL غير موجود في .env.local');
    process.exit(1);
  }
  return url;
}

function parseDbUrl(url) {
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/(.+)$/);
  if (!m) return null;
  return { user: m[1], password: decodeURIComponent(m[2]), host: m[3], port: Number(m[4]), database: m[5] };
}

async function tryConnect(config, label) {
  const client = new pg.Client({ ...config, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
  try {
    await client.connect();
    console.log(`✓ متصل عبر: ${label}`);
    return client;
  } catch (err) {
    try { await client.end(); } catch { /* ignore */ }
    return { error: err };
  }
}

/** الاتصال بقاعدة البيانات: مباشر أولًا، ثم عبر Pooler لكل المناطق */
export async function connectDb() {
  const url = getDbConfig();
  const parsed = parseDbUrl(url);
  if (!parsed) {
    console.error('✗ صيغة SUPABASE_DB_URL غير صحيحة');
    process.exit(1);
  }

  const direct = await tryConnect(parsed, `${parsed.host} (مباشر)`);
  if (direct instanceof pg.Client) return direct;
  console.log(`… الاتصال المباشر فشل (${direct.error?.code ?? direct.error?.message}) — جاري تجربة الـ Pooler`);

  const refMatch = parsed.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  const ref = refMatch?.[1];
  if (!ref) {
    console.error('✗ تعذر استخراج مُعرّف المشروع من العنوان');
    process.exit(1);
  }

  for (const region of POOLER_REGIONS) {
    for (const host of [`aws-0-${region}.pooler.supabase.com`, `aws-1-${region}.pooler.supabase.com`]) {
      const result = await tryConnect(
        { user: `postgres.${ref}`, password: parsed.password, host, port: 5432, database: parsed.database },
        `${host}`,
      );
      if (result instanceof pg.Client) return result;
      const code = result.error?.code ?? '';
      const msg = String(result.error?.message ?? '');
      // خطأ مصادقة يعني أن المضيف صحيح لكن كلمة المرور خاطئة — لا داعي لتجربة مناطق أخرى
      if (msg.includes('password') || code === '28P01') {
        console.error(`✗ كلمة مرور قاعدة البيانات مرفوضة على ${host}`);
        process.exit(1);
      }
      if (code === 'ENOTFOUND') continue;
      if (msg.includes('Tenant or user not found')) continue;
    }
  }

  console.error('✗ تعذر الاتصال بقاعدة البيانات عبر كل الطرق. تحقق من الشبكة أو استخدم Session Pooler URL من لوحة Supabase (Connect → Session pooler) وضعه في SUPABASE_DB_URL.');
  process.exit(1);
}

export function readSql(relPath) {
  const full = resolve(process.cwd(), relPath);
  if (!existsSync(full)) {
    console.error(`✗ الملف غير موجود: ${relPath}`);
    process.exit(1);
  }
  return readFileSync(full, 'utf8');
}
