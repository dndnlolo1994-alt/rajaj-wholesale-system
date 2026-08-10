// منصة اختبار قاعدة البيانات: PostgreSQL حقيقي (ملفات @embedded-postgres)
// + محاكاة auth الخاصة بـ Supabase + تشغيل نفس Migrations الإنتاج حرفيًا.
//
// ملاحظة Windows: ملفات PostgreSQL لا تعمل من مسار يحوي حروفًا غير لاتينية
// (مجلد المشروع داخل "المسار الذهبي")، لذلك تُنسخ مرة واحدة إلى مسار ASCII
// ثابت وتُشغَّل مباشرة بدون غلاف المكتبة.

import { readdirSync, readFileSync, mkdtempSync, existsSync, cpSync, rmSync } from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import pg from 'pg';

export const OWNER_ID = '00000000-0000-0000-0000-00000000aa01';
export const SALES_ID = '00000000-0000-0000-0000-00000000aa02';

const require = createRequire(import.meta.url);

function binariesDir(): string {
  const pkg =
    process.platform === 'win32'
      ? '@embedded-postgres/windows-x64'
      : process.platform === 'darwin'
        ? `@embedded-postgres/darwin-${process.arch === 'arm64' ? 'arm64' : 'x64'}`
        : `@embedded-postgres/linux-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
  let nativeDir = resolve(process.cwd(), 'node_modules', pkg, 'native');
  if (!existsSync(nativeDir)) {
    nativeDir = join(dirname(require.resolve(pkg)), 'native');
  }

  // على Windows: انسخ لمسار ASCII إذا كان مسار المشروع يحوي حروفًا غير لاتينية
  if (process.platform === 'win32' && /[^\x20-\x7E]/.test(nativeDir)) {
    const dest = 'C:\\Users\\Public\\rajaei-pg\\native';
    if (!existsSync(join(dest, 'bin', 'postgres.exe'))) {
      cpSync(nativeDir, dest, { recursive: true });
    }
    return dest;
  }
  return nativeDir;
}

const AUTH_SHIM = `
create schema if not exists auth;
create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text, role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists auth.identities (
  id uuid primary key,
  user_id uuid,
  provider_id text,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
create or replace function auth.uid() returns uuid
language sql stable
as $fn$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$fn$;
do $roles$
begin
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $roles$;
`;

export interface DbHarness {
  client: pg.Client;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  rpcFail: (fn: string, args: Record<string, unknown>, code: string) => Promise<void>;
  q: <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
  one: <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]) => Promise<T>;
  actAs: (userId: string) => Promise<void>;
  stop: () => Promise<void>;
}

async function waitForReady(port: number, tries = 80): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const probe = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', connectionTimeoutMillis: 1500 });
    try {
      await probe.connect();
      await probe.end();
      return;
    } catch {
      await probe.end().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error('PostgreSQL لم يصبح جاهزًا خلال المهلة');
}

export async function startHarness(): Promise<DbHarness> {
  const bins = binariesDir();
  const dataDir = mkdtempSync(join(tmpdir(), 'rajaei-pg-'));
  const port = 54100 + Math.floor(Math.random() * 400);

  const init = spawnSync(join(bins, 'bin', 'initdb' + (process.platform === 'win32' ? '.exe' : '')), [
    '--pgdata', dataDir,
    '-U', 'postgres',
    '--auth', 'trust',
    '-E', 'UTF8',
    '--locale', 'C',
    '--no-instructions',
  ], { encoding: 'utf8' });
  if (init.status !== 0) {
    throw new Error(`initdb فشل: ${init.stderr || init.stdout}`);
  }

  const server: ChildProcess = spawn(join(bins, 'bin', 'postgres' + (process.platform === 'win32' ? '.exe' : '')), [
    '-D', dataDir,
    '-p', String(port),
    '-c', 'listen_addresses=127.0.0.1',
    '-c', 'fsync=off',
    '-c', 'synchronous_commit=off',
    '-c', 'full_page_writes=off',
  ], { stdio: 'ignore' });

  await waitForReady(port);

  const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  await client.connect();

  await client.query(AUTH_SHIM);
  const migrationsDir = resolve(process.cwd(), 'supabase', 'migrations');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await client.query(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (e) {
      throw new Error(`فشل تطبيق ${file}: ${(e as Error).message}`);
    }
  }

  await client.query(
    `insert into auth.users (id, email) values ($1, 'owner@test.local'), ($2, 'sales@test.local')`,
    [OWNER_ID, SALES_ID],
  );
  await client.query(
    `insert into public.profiles (id, full_name, role) values ($1, 'رجائي المصري', 'owner'), ($2, 'موظف مبيعات', 'sales')`,
    [OWNER_ID, SALES_ID],
  );

  const actAs = async (userId: string) => {
    await client.query(`select set_config('request.jwt.claims', $1, false)`, [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
  };
  await actAs(OWNER_ID);

  const rpc = async (fn: string, args: Record<string, unknown> = {}) => {
    const keys = Object.keys(args);
    const placeholders = keys.map((k, i) => `${k} => $${i + 1}${k === 'p' ? '::jsonb' : ''}`).join(', ');
    const values = keys.map((k) => (typeof args[k] === 'object' && args[k] !== null ? JSON.stringify(args[k]) : args[k]));
    const { rows } = await client.query(`select public.${fn}(${placeholders}) as result`, values);
    return rows[0]?.result as Record<string, unknown>;
  };

  const rpcFail = async (fn: string, args: Record<string, unknown>, code: string) => {
    try {
      await rpc(fn, args);
    } catch (e) {
      const msg = (e as { message?: string }).message ?? '';
      if (msg !== code) {
        throw new Error(`توقعنا الخطأ ${code} لكن حدث: ${msg}`);
      }
      return;
    }
    throw new Error(`توقعنا فشل ${fn} بكود ${code} لكنه نجح`);
  };

  const stop = async () => {
    await client.end().catch(() => undefined);
    const pgCtl = join(bins, 'bin', 'pg_ctl' + (process.platform === 'win32' ? '.exe' : ''));
    spawnSync(pgCtl, ['stop', '-D', dataDir, '-m', 'immediate', '-t', '20'], { encoding: 'utf8' });
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // مجلد مؤقت — سينظفه النظام
    }
  };

  return {
    client,
    rpc,
    rpcFail,
    q: async (sql, params) => (await client.query(sql, params)).rows,
    one: async (sql, params) => (await client.query(sql, params)).rows[0],
    actAs,
    stop,
  };
}
