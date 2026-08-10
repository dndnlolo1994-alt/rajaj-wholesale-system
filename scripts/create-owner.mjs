// إنشاء حساب المالك (رجائي المصري) عبر Supabase Admin API
// الاستخدام: node scripts/create-owner.mjs <email> <password> ["الاسم الكامل"]
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجود في .env.local');
  process.exit(1);
}

const email = process.argv[2] ?? 'rajaei@rajaei.app';
const password = process.argv[3] ?? 'Rajaei@2026';
const fullName = process.argv[4] ?? 'رجائي المصري';

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

let userId = created?.user?.id;

if (error) {
  if (String(error.message).includes('already') || error.code === 'email_exists') {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    const existing = list?.users?.find((u) => u.email === email);
    if (!existing) {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    }
    userId = existing.id;
    console.log('↷ المستخدم موجود مسبقًا — سيتم التأكد من ملفه فقط');
  } else {
    console.error(`✗ فشل إنشاء المستخدم: ${error.message}`);
    process.exit(1);
  }
}

const { error: profileError } = await admin.from('profiles').upsert({
  id: userId,
  full_name: fullName,
  role: 'owner',
  is_active: true,
});

if (profileError) {
  console.error(`✗ فشل إنشاء ملف المالك: ${profileError.message}`);
  process.exit(1);
}

console.log('✓ تم تجهيز حساب المالك:');
console.log(`  البريد: ${email}`);
console.log(`  كلمة المرور: ${password}`);
console.log('  الدور: owner (كامل الصلاحيات)');
