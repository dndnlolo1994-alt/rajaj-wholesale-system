'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardCheck, DatabaseBackup, Download, Plus, Printer, Radio, Router, ShieldCheck, UserPlus, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, NumericInput, Select } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { parseMoney, parseQty } from '@/lib/calc/money';
import { checkBridge } from '@/lib/printing/escpos';
import { DEFAULT_OWNER_PHOTO_URL, paymentMethodLabels } from '@/lib/settings-shared';
import type { AppSettings, PrinterSettings } from '@/lib/settings-shared';
import type { PaymentMethod, Profile, UserRole } from '@/lib/types/db';
import { roleLabelsClient } from '@/components/shell/role-labels';
import { createUserAction, updateSettingAction, updateUserAction } from '@/server/actions/settings';

function useSave() {
  const router = useRouter();
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const save = async (key: string, value: unknown) => {
    setSaving(true);
    const res = await updateSettingAction(key, value);
    setSaving(false);
    if (res.ok) {
      success('تم حفظ الإعدادات');
      router.refresh();
    } else {
      error('لم تُحفظ الإعدادات', res.error.message);
    }
  };
  return { save, saving };
}

function photoPreviewStyle(src?: string | null) {
  const safeSrc = (src?.trim() || DEFAULT_OWNER_PHOTO_URL).replace(/"/g, '%22');
  return { backgroundImage: `url("${safeSrc}")` };
}

async function resizeOwnerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('اختار ملف صورة فقط');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('حجم الصورة كبير. اختار صورة أقل من 5MB');
  }

  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر تجهيز الصورة'));
    img.src = src;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('المتصفح لم يستطع ضغط الصورة');

  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - size) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - size) / 2);
  context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 512, 512);

  return canvas.toDataURL('image/jpeg', 0.82);
}

// =====================================================================
export function BusinessForm({ business, invoice }: { business: AppSettings['business']; invoice: AppSettings['invoice'] }) {
  const { save, saving } = useSave();
  const { error } = useToast();
  const [b, setB] = useState(business);
  const [inv, setInv] = useState(invoice);

  const handlePhotoChange = async (file?: File) => {
    if (!file) return;
    try {
      const ownerPhotoUrl = await resizeOwnerPhoto(file);
      setB({ ...b, owner_photo_url: ownerPhotoUrl });
    } catch (e) {
      error('لم يتم رفع الصورة', e instanceof Error ? e.message : 'جرب صورة ثانية');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="بيانات النشاط (تظهر على الفواتير المطبوعة)" />
        <CardBody className="space-y-4">
          <Field label="اسم المنشأة" required>
            <Input value={b.business_name} onChange={(e) => setB({ ...b, business_name: e.target.value })} />
          </Field>
          <Field label="اسم صاحب النشاط" required>
            <Input value={b.owner_name} onChange={(e) => setB({ ...b, owner_name: e.target.value })} />
          </Field>
          <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-3">
            <div className="flex items-center gap-3">
              <span
                aria-label="معاينة صورة صاحب النشاط"
                className="block size-16 shrink-0 rounded-2xl bg-cover bg-center shadow-card ring-2 ring-white"
                style={photoPreviewStyle(b.owner_photo_url)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-ink-900">صورة صاحب النشاط بجانب الاسم</p>
                <p className="mt-1 text-xs leading-5 text-ink-500">تظهر في القائمة الجانبية وأعلى شاشة الجوال. ارفع صورة جديدة ثم اضغط حفظ.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary-800 px-3 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-primary-900">
                    رفع / تغيير الصورة
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => void handlePhotoChange(event.target.files?.[0])}
                    />
                  </label>
                  {b.owner_photo_url && b.owner_photo_url !== DEFAULT_OWNER_PHOTO_URL ? (
                    <Button variant="outline" size="sm" onClick={() => setB({ ...b, owner_photo_url: DEFAULT_OWNER_PHOTO_URL })}>
                      استرجاع الصورة الأساسية
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الهاتف">
              <Input dir="ltr" className="text-end" value={b.phone} onChange={(e) => setB({ ...b, phone: e.target.value })} />
            </Field>
            <Field label="العنوان">
              <Input value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} />
            </Field>
          </div>
          <Field label="عبارة أسفل الفاتورة">
            <Input value={b.invoice_footer} onChange={(e) => setB({ ...b, invoice_footer: e.target.value })} />
          </Field>
          <Field label="رابط الشعار (اختياري)" hint="يمكن رفع الشعار إلى تخزين Supabase ولصق الرابط هنا">
            <Input dir="ltr" value={b.logo_url ?? ''} onChange={(e) => setB({ ...b, logo_url: e.target.value || null })} />
          </Field>
          <Button onClick={() => save('business', b)} loading={saving}>حفظ بيانات النشاط</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="بادئات الترقيم" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ['prefix', 'فواتير البيع'],
                ['purchase_prefix', 'المشتريات'],
                ['return_prefix', 'المرتجعات'],
                ['receipt_prefix', 'سندات القبض'],
                ['voucher_prefix', 'سندات الصرف'],
                ['expense_prefix', 'المصروفات'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input dir="ltr" className="text-center font-bold" value={inv[key]} maxLength={6}
                  onChange={(e) => setInv({ ...inv, [key]: e.target.value.toUpperCase() })} />
              </Field>
            ))}
          </div>
          <p className="text-xs text-ink-500">مثال: {inv.prefix}-2026-000123 — تغيير البادئة يؤثر على الفواتير الجديدة فقط.</p>
          <Button onClick={() => save('invoice', inv)} loading={saving}>حفظ الترقيم</Button>
        </CardBody>
      </Card>
    </div>
  );
}

// =====================================================================
export function SystemForm({
  sales, inventory, debts, cashbox,
}: {
  sales: AppSettings['sales']; inventory: AppSettings['inventory'];
  debts: AppSettings['debts']; cashbox: AppSettings['cashbox'];
}) {
  const { save, saving } = useSave();
  const [s, setS] = useState(sales);
  const [inv, setInv] = useState(inventory);
  const [d, setD] = useState(debts);
  const [c, setC] = useState(cashbox);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="المبيعات" />
        <CardBody className="space-y-4">
          <Field label="طريقة الدفع الافتراضية">
            <Select value={s.default_payment_method} onChange={(e) => setS({ ...s, default_payment_method: e.target.value as PaymentMethod })}>
              {Object.entries(paymentMethodLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="حد تنبيه الفاتورة الكبيرة (د.أ)" hint="0 = تعطيل التنبيه">
            <NumericInput money value={s.big_invoice_threshold}
              onChange={(e) => setS({ ...s, big_invoice_threshold: parseMoney(e.target.value) ?? 0 })} />
          </Field>
          <Button onClick={() => save('sales', s)} loading={saving}>حفظ إعدادات المبيعات</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="المخزون" />
        <CardBody className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 p-3">
            <span>
              <span className="block text-sm font-bold">السماح ببيع كمية غير متوفرة (مخزون سالب)</span>
              <span className="block text-xs text-ink-500">افتراضيًا مغلق — عند تفعيله يستطيع النظام البيع تحت الصفر مع تسجيل الحركة</span>
            </span>
            <input type="checkbox" className="size-5 accent-primary-700" checked={inv.allow_negative_stock}
              onChange={(e) => setInv({ ...inv, allow_negative_stock: e.target.checked })} />
          </label>
          <Field label="عدد أيام اعتبار الصنف راكدًا">
            <NumericInput value={inv.stagnant_days} onChange={(e) => setInv({ ...inv, stagnant_days: parseQty(e.target.value) ?? 45 })} />
          </Field>
          <Button onClick={() => save('inventory', inv)} loading={saving}>حفظ إعدادات المخزون</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="الديون والصندوق" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="تنبيه دين قديم بعد (يوم)">
              <NumericInput value={d.old_debt_days} onChange={(e) => setD({ ...d, old_debt_days: parseQty(e.target.value) ?? 30 })} />
            </Field>
            <Field label="دين حرج بعد (يوم)">
              <NumericInput value={d.critical_debt_days} onChange={(e) => setD({ ...d, critical_debt_days: parseQty(e.target.value) ?? 60 })} />
            </Field>
          </div>
          <Button onClick={() => save('debts', d)} loading={saving} variant="secondary">حفظ إعدادات الديون</Button>
          <Field label="الرصيد الافتتاحي للصندوق (د.أ)" hint="يُستخدم قبل أول إغلاق يومي فقط">
            <NumericInput money value={c.opening_balance}
              onChange={(e) => setC({ ...c, opening_balance: parseMoney(e.target.value) ?? 0 })} />
          </Field>
          <Button onClick={() => save('cashbox', c)} loading={saving} variant="secondary">حفظ رصيد الصندوق</Button>
        </CardBody>
      </Card>
    </div>
  );
}

// =====================================================================
export function PrinterForm({ printer }: { printer: PrinterSettings }) {
  const { save, saving } = useSave();
  const { success, error } = useToast();
  const [p, setP] = useState(printer);
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');

  const testBridge = async () => {
    setBridgeStatus('checking');
    const ok = await checkBridge(p.bridge_url);
    setBridgeStatus(ok ? 'online' : 'offline');
  };

  const copyBridgeUrl = async () => {
    try {
      await navigator.clipboard.writeText(p.bridge_url || 'http://127.0.0.1:9723');
      success('تم نسخ رابط برنامج الطباعة');
    } catch {
      error('تعذر النسخ', 'انسخ الرابط يدويًا من الحقل.');
    }
  };

  return (
    <Card>
      <CardHeader title="إعدادات طابعة الفواتير الحرارية" />
      <CardBody className="space-y-4">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-l from-primary-50 to-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-white shadow-card">
              <Wifi className="size-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-primary-950">ربط لاسلكي سهل وفخم</p>
              <p className="mt-1 text-xs leading-5 text-ink-600">
                للطابعات الحرارية Wi‑Fi/LAN: اختار «طابعة Wi‑Fi مباشرة»، اكتب IP الطابعة، اضغط فحص، ثم جرّب طباعة اختبار.
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-primary-800">
                على الهاتف: افتح النظام عادي، والطباعة المباشرة تمر عبر جهاز كاشير/كمبيوتر شغّال عليه مشغّل الطابعة بنفس الشبكة. أما PDF / إرسال فيعمل من الهاتف مباشرة.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ['1', 'اختار طريقة الطباعة', 'متصفح عادي أو إرسال مباشر للطابعة'],
              ['2', 'اكتب IP الطابعة', 'تجده من شاشة الطابعة أو الراوتر'],
              ['3', 'افحص واطبع اختبار', 'إذا ظهرت ✓ تصبح جاهزة'],
            ].map(([step, title, text]) => (
              <div key={step} className="rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                <span className="mb-2 flex size-7 items-center justify-center rounded-full bg-gold-100 text-xs font-black text-primary-900">{step}</span>
                <p className="text-xs font-extrabold text-ink-900">{title}</p>
                <p className="mt-1 text-[11px] leading-4 text-ink-500">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <Field label="عرض الورق">
          <Segmented value={String(p.paper_width) as '58' | '80'}
            onChange={(v) => setP({ ...p, paper_width: Number(v) as 58 | 80 })}
            options={[{ value: '80', label: '80mm' }, { value: '58', label: '58mm' }]} />
        </Field>

        <Field label="طريقة الطباعة">
          <Segmented value={p.mode} onChange={(v) => setP({ ...p, mode: v })}
            options={[
              { value: 'browser', label: 'حوار المتصفح' },
              { value: 'bridge', label: 'طابعة Wi‑Fi مباشرة' },
            ]} />
          <p className="mt-1.5 text-xs leading-5 text-ink-500">
            «حوار المتصفح» يعمل فورًا مع أي طابعة مضافة على الجهاز. «طابعة Wi‑Fi مباشرة» ترسل الإيصال للطابعة بدون نافذة طباعة، بشرط تشغيل برنامج الطباعة المحلي على جهاز في نفس الشبكة.
          </p>
        </Field>

        {p.mode === 'bridge' ? (
          <div className="space-y-4 rounded-2xl border border-primary-200 bg-primary-50/50 p-3">
            <div className="rounded-2xl border border-gold-200 bg-gradient-to-l from-gold-50 to-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-primary-950">تشغيل سريع لبرنامج الطباعة</p>
                  <p className="mt-1 text-xs leading-5 text-ink-600">
                    نزّل الملف على جهاز الكاشير أو أي كمبيوتر داخل المحل وشغّله، واترك النافذة السوداء مفتوحة. بعدها الهاتف يرسل أوامر الطباعة لهذا الجهاز.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/print-bridge/start-rajaei-printer.cmd"
                    download
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary-800 px-3 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-primary-900"
                  >
                    <Download className="size-4" />
                    تنزيل مشغّل الطابعة
                  </a>
                  <Button variant="outline" size="sm" onClick={copyBridgeUrl}>
                    <ClipboardCheck className="size-4" />
                    نسخ الرابط
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-xl bg-white p-3 ring-1 ring-primary-100">
                <Router className="mt-0.5 size-5 text-primary-700" />
                <div>
                  <p className="text-xs font-extrabold text-ink-900">نفس الشبكة</p>
                  <p className="mt-1 text-[11px] leading-4 text-ink-500">الجهاز والطابعة لازم يكونوا على نفس Wi‑Fi أو نفس الراوتر.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-white p-3 ring-1 ring-primary-100">
                <Radio className="mt-0.5 size-5 text-primary-700" />
                <div>
                  <p className="text-xs font-extrabold text-ink-900">منفذ الطابعة</p>
                  <p className="mt-1 text-[11px] leading-4 text-ink-500">أغلب الطابعات الحرارية تستخدم Port 9100، خليه كما هو إلا إذا الطابعة مختلفة.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IP الطابعة" required hint="مثال: 192.168.1.100">
                <Input dir="ltr" placeholder="192.168.1.100" value={p.printer_ip}
                  onChange={(e) => setP({ ...p, printer_ip: e.target.value.trim() })} />
              </Field>
              <Field label="المنفذ (Port)">
                <NumericInput value={p.printer_port}
                  onChange={(e) => setP({ ...p, printer_port: parseQty(e.target.value) ?? 9100 })} />
              </Field>
            </div>
            <Field label="رابط برنامج الطباعة المحلي" hint="اتركه كما هو إذا البرنامج يعمل على نفس الجهاز">
              <div className="flex gap-2">
                <Input dir="ltr" value={p.bridge_url} onChange={(e) => setP({ ...p, bridge_url: e.target.value.trim() })} />
                <Button variant="outline" onClick={testBridge} loading={bridgeStatus === 'checking'}>
                  {bridgeStatus === 'online' ? <Wifi className="size-4 text-emerald-600" /> : <WifiOff className="size-4" />}
                  فحص
                </Button>
              </div>
              {bridgeStatus === 'online' ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  برنامج الطباعة متصل ✓
                </p>
              ) : null}
              {bridgeStatus === 'offline' ? <p className="mt-1 text-xs font-bold text-red-600">برنامج الطباعة غير متاح — شغّله ثم أعد الفحص</p> : null}
            </Field>
            <Field label="اسم الطابعة (للتوثيق)">
              <Input value={p.printer_name} onChange={(e) => setP({ ...p, printer_name: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" className="size-4 accent-primary-700" checked={p.cut}
                  onChange={(e) => setP({ ...p, cut: e.target.checked })} />
                قص الورق آليًا
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" className="size-4 accent-primary-700" checked={p.cash_drawer}
                  onChange={(e) => setP({ ...p, cash_drawer: e.target.checked })} />
                فتح درج النقد
              </label>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="عدد النسخ">
            <NumericInput value={p.copies} onChange={(e) => setP({ ...p, copies: Math.max(1, parseQty(e.target.value) ?? 1) })} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-bold">
            <input type="checkbox" className="size-4 accent-primary-700" checked={p.auto_print}
              onChange={(e) => setP({ ...p, auto_print: e.target.checked })} />
            طباعة تلقائية بعد كل بيع
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save('printer', p)} loading={saving}>حفظ إعدادات الطابعة</Button>
          <Button variant="outline" onClick={() => window.open(`/print/test?auto=1&w=${p.paper_width}`, '_blank', 'noopener,width=460,height=680')}>
            <Printer className="size-4" />
            اختبار طباعة
          </Button>
        </div>
        <p className="text-xs text-ink-500">احفظ الإعدادات أولًا ثم جرّب اختبار الطباعة.</p>
      </CardBody>
    </Card>
  );
}

// =====================================================================
export function BackupForm({ backup }: { backup: AppSettings['backup'] }) {
  const { save, saving } = useSave();
  const [b, setB] = useState(backup);

  return (
    <Card>
      <CardHeader title="إعدادات النسخ الاحتياطي" />
      <CardBody className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 p-3">
          <span>
            <span className="block text-sm font-bold">النسخ التلقائي اليومي</span>
            <span className="block text-xs text-ink-500">يعمل عبر Vercel Cron عند النشر — الساعة 2 فجرًا بتوقيت عمّان، ويُخزّن في Supabase Storage</span>
          </span>
          <input type="checkbox" className="size-5 accent-primary-700" checked={b.auto_enabled}
            onChange={(e) => setB({ ...b, auto_enabled: e.target.checked })} />
        </label>
        <Field label="مدة الاحتفاظ بالنسخ (يوم)">
          <NumericInput value={b.retention_days} onChange={(e) => setB({ ...b, retention_days: parseQty(e.target.value) ?? 30 })} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save('backup', b)} loading={saving}>حفظ</Button>
          <Button variant="outline" onClick={() => window.open('/api/backup/export', '_blank')}>
            <Download className="size-4" />
            تنزيل نسخة كاملة الآن (JSON)
          </Button>
        </div>
        <p className="text-xs leading-5 text-ink-500">
          سجل النسخ وحالتها في صفحة <a href="/backup" className="font-bold text-primary-700 hover:underline">النسخ الاحتياطي</a>.
          آلية الاسترجاع موثقة في docs/BACKUP.md
        </p>
      </CardBody>
    </Card>
  );
}

// =====================================================================
export function UsersSection({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'sales' as UserRole });
  const [saving, setSaving] = useState(false);

  const addUser = async () => {
    setSaving(true);
    const res = await createUserAction(form);
    setSaving(false);
    if (res.ok) {
      success('أُنشئ المستخدم بنجاح');
      setAddOpen(false);
      setForm({ email: '', password: '', full_name: '', role: 'sales' });
      router.refresh();
    } else {
      error('تعذر إنشاء المستخدم', res.error.message);
    }
  };

  const patchUser = async (id: string, patch: { role?: UserRole; is_active?: boolean }) => {
    const res = await updateUserAction({ id, ...patch });
    if (res.ok) {
      success('تم التحديث');
      router.refresh();
    } else {
      error('تعذر التحديث', res.error.message);
    }
  };

  return (
    <Card>
      <CardHeader
        title="المستخدمون والصلاحيات"
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" />
            مستخدم جديد
          </Button>
        }
      />
      <div className="divide-y divide-ink-100">
        {profiles.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold">{u.full_name}</p>
              <p className="text-xs text-ink-500">{roleLabelsClient[u.role]}{u.is_active ? '' : ' — موقوف'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Select className="h-9 w-40 text-xs" value={u.role}
                onChange={(e) => patchUser(u.id, { role: e.target.value as UserRole })}>
                {Object.entries(roleLabelsClient).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
              {u.is_active ? (
                <Button variant="outline" size="sm" onClick={() => patchUser(u.id, { is_active: false })}>إيقاف</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => patchUser(u.id, { is_active: true })}>تفعيل</Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <CardBody className="border-t border-ink-100">
        <p className="text-xs leading-5 text-ink-500">
          الأدوار: <b>المالك</b> كل الصلاحيات — <b>مدير</b> كل العمليات بلا إعدادات — <b>مبيعات</b> البيع والعملاء والتحصيل (بدون أرباح وتكاليف) —
          <b> مستودع</b> الأصناف والمشتريات والجرد — <b>محاسب</b> الدفعات والمصروفات والصندوق والتقارير.
        </p>
      </CardBody>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="إضافة مستخدم"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={addUser} loading={saving}><Plus className="size-4" />إنشاء</Button>
          </>
        }>
        <div className="space-y-3">
          <Field label="الاسم الكامل" required>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="البريد الإلكتروني" required>
            <Input dir="ltr" type="email" className="text-end" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="كلمة المرور" required hint="8 أحرف على الأقل">
            <Input dir="ltr" type="text" className="text-end" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="الدور" required>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {Object.entries(roleLabelsClient).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}

// =====================================================================
export function DataProtectionPanel() {
  return (
    <Card className="border-emerald-200 bg-gradient-to-l from-emerald-50/80 to-white">
      <CardHeader title="حماية بيانات الإنتاج" />
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-extrabold text-emerald-950">الحذف النهائي مقفل</p>
            <p className="mt-1 text-sm leading-6 text-emerald-900/75">
              لا يمكن تصفير قاعدة البيانات من داخل النظام، ولا يمكن حذف الفواتير أو الحركات المالية أو الأصناف والعملاء والموردين نهائيًا.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-white/80 p-3">
          <DatabaseBackup className="mt-0.5 size-5 shrink-0 text-primary-700" />
          <div>
            <p className="text-sm font-extrabold text-ink-900">نسخ يومية وتقارير قابلة للتنزيل</p>
            <p className="mt-1 text-xs leading-5 text-ink-500">نزّل نسخة JSON للاسترجاع أو تقرير PDF كامل من صفحة النسخ الاحتياطي في أي وقت.</p>
            <a href="/backup" className="mt-2 inline-flex text-xs font-extrabold text-primary-700 hover:underline">فتح النسخ الاحتياطي</a>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
