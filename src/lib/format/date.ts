// تنسيق التاريخ والوقت — توقيت عمّان، أسماء الأشهر بالعربي، أرقام لاتينية

export const APP_TZ = 'Asia/Amman';

const dateFmt = new Intl.DateTimeFormat('ar-JO-u-nu-latn', {
  timeZone: APP_TZ, day: 'numeric', month: 'long', year: 'numeric',
});
const dateShortFmt = new Intl.DateTimeFormat('ar-JO-u-nu-latn', {
  timeZone: APP_TZ, day: '2-digit', month: '2-digit', year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('ar-JO-u-nu-latn', {
  timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', hour12: true,
});
const dateTimeFmt = new Intl.DateTimeFormat('ar-JO-u-nu-latn', {
  timeZone: APP_TZ, day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
});
const weekdayFmt = new Intl.DateTimeFormat('ar-JO-u-nu-latn', {
  timeZone: APP_TZ, weekday: 'long',
});

function asDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 10 آب 2026 */
export function fmtDate(d: string | Date | null | undefined): string {
  const date = asDate(d);
  return date ? dateFmt.format(date) : '—';
}

/** 10/08/2026 */
export function fmtDateShort(d: string | Date | null | undefined): string {
  const date = asDate(d);
  return date ? dateShortFmt.format(date) : '—';
}

/** 02:45 م */
export function fmtTime(d: string | Date | null | undefined): string {
  const date = asDate(d);
  return date ? timeFmt.format(date) : '—';
}

/** 10 آب 2026، 02:45 م */
export function fmtDateTime(d: string | Date | null | undefined): string {
  const date = asDate(d);
  return date ? dateTimeFmt.format(date) : '—';
}

/** الأحد */
export function fmtWeekday(d: string | Date | null | undefined): string {
  const date = asDate(d);
  return date ? weekdayFmt.format(date) : '';
}

/** YYYY-MM-DD بتوقيت عمّان (لحقول التاريخ ومعاملات التقارير) */
export function localDayISO(d: Date | string = new Date()): string {
  const date = asDate(d) ?? new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  return parts; // en-CA => YYYY-MM-DD
}

export function todayISO(): string {
  return localDayISO(new Date());
}

/** أول يوم من الشهر الحالي بتوقيت عمّان */
export function monthStartISO(offsetMonths = 0): string {
  const today = todayISO();
  const [y, m] = today.split('-').map(Number);
  const total = (y * 12 + (m - 1)) + offsetMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/** آخر يوم من شهر معيّن */
export function monthEndISO(offsetMonths = 0): string {
  const start = monthStartISO(offsetMonths + 1);
  const [y, m] = start.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** إزاحة يوم بصيغة ISO */
export function addDaysISO(dayISO: string, days: number): string {
  const [y, m, d] = dayISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** "منذ 3 أيام" — نص نسبي مبسّط */
export function fmtRelative(d: string | Date | null | undefined): string {
  const date = asDate(d);
  if (!date) return '—';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${months} شهر`;
  return `منذ ${Math.floor(months / 12)} سنة`;
}

/** فترات جاهزة للتقارير */
export type PeriodPreset = 'today' | 'yesterday' | 'week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export const periodLabels: Record<PeriodPreset, string> = {
  today: 'اليوم',
  yesterday: 'أمس',
  week: 'آخر 7 أيام',
  this_month: 'هذا الشهر',
  last_month: 'الشهر الماضي',
  this_year: 'هذه السنة',
  custom: 'فترة مخصصة',
};

export function periodRange(preset: PeriodPreset): { from: string; to: string } {
  const today = todayISO();
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': {
      const y = addDaysISO(today, -1);
      return { from: y, to: y };
    }
    case 'week': return { from: addDaysISO(today, -6), to: today };
    case 'this_month': return { from: monthStartISO(0), to: today };
    case 'last_month': return { from: monthStartISO(-1), to: monthEndISO(-1) };
    case 'this_year': return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default: return { from: today, to: today };
  }
}
