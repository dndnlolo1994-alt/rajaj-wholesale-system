export const env = {
  get supabaseUrl(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  },
  get supabaseAnonKey(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  },
  get serviceRoleKey(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  },
  get cronSecret(): string {
    return process.env.CRON_SECRET ?? '';
  },
};

/** هل إعدادات Supabase الأساسية موجودة؟ */
export function hasSupabaseEnv(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
