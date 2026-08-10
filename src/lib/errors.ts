// توحيد قراءة أخطاء قاعدة البيانات:
// دوال النظام ترفع: message = كود آلي، detail = رسالة عربية، hint = meta JSON

export interface AppError {
  code: string;
  message: string;
  meta?: unknown;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  AUTH_NO_PROFILE: 'لا يوجد ملف مستخدم مرتبط بهذا الحساب.',
  AUTH_INACTIVE: 'هذا الحساب موقوف.',
  AUTH_FORBIDDEN: 'ليست لديك صلاحية لتنفيذ هذه العملية.',
  INSUFFICIENT_STOCK: 'الكمية المطلوبة غير متوفرة في المخزون.',
  OVER_CREDIT_LIMIT: 'تم تجاوز الحد الائتماني للعميل.',
  PAID_EXCEEDS_TOTAL: 'المبلغ المدفوع أكبر من الإجمالي.',
  CASH_SALE_MUST_BE_PAID: 'البيع النقدي يجب أن يُدفع بالكامل.',
  SALE_NO_ITEMS: 'لا يمكن حفظ فاتورة بدون أصناف.',
  DELETE_FORBIDDEN: 'لا يُسمح بالحذف النهائي للسجلات المالية.',
  REASON_REQUIRED: 'السبب مطلوب.',
  '23505': 'هذه القيمة مسجّلة مسبقًا (قيمة مكررة).',
  '23503': 'لا يمكن تنفيذ العملية — السجل مرتبط ببيانات أخرى.',
  '23514': 'قيمة غير صالحة — تحقق من الأرقام المدخلة.',
  PGRST301: 'انتهت الجلسة. سجّل الدخول مجددًا.',
};

interface PgErrorLike {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

/** تحويل خطأ Supabase/PostgREST إلى خطأ موحّد بالعربية */
export function toAppError(error: unknown): AppError {
  if (!error) return { code: 'UNKNOWN', message: 'حدث خطأ غير متوقع.' };

  const e = error as PgErrorLike;
  const rawCode = e.message && /^[A-Z0-9_]+$/.test(e.message) ? e.message : (e.code ?? 'UNKNOWN');

  let meta: unknown;
  if (e.hint) {
    try {
      meta = JSON.parse(e.hint);
    } catch {
      meta = undefined;
    }
  }

  const arabic =
    (e.details && /[؀-ۿ]/.test(e.details) ? e.details : undefined) ??
    FALLBACK_MESSAGES[rawCode] ??
    (typeof e.message === 'string' && /[؀-ۿ]/.test(e.message) ? e.message : undefined) ??
    'حدث خطأ غير متوقع. حاول مرة أخرى.';

  return { code: rawCode, message: arabic, meta };
}

/** ناتج موحّد لكل Server Actions */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionErr<T = undefined>(error: unknown): ActionResult<T> {
  return { ok: false, error: toAppError(error) };
}
