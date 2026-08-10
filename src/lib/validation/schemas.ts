import { z } from 'zod';

// مخططات التحقق — تُطبَّق في Server Actions قبل الوصول لقاعدة البيانات
// (قاعدة البيانات نفسها تعيد التحقق وتفرض القيود — دفاع مزدوج)

export const unitKindSchema = z.enum(['carton', 'piece']);
export const paymentMethodSchema = z.enum(['cash', 'bank_transfer', 'wallet', 'cheque', 'other']);
export const itemConditionSchema = z.enum(['good', 'damaged']);

const money = z.number().finite().nonnegative();
const moneyPositive = z.number().finite().positive();
const qty = z.number().int().positive();
const uuid = z.uuid();
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((s) => (s === '' ? null : s))
  .nullable()
  .optional();

// ---------------------------------------------------------------------
// البيع
// ---------------------------------------------------------------------
export const saleItemInputSchema = z.object({
  product_id: uuid,
  unit: unitKindSchema,
  qty,
  unit_price: money,
  discount: money.default(0),
});

export const saleInputSchema = z.object({
  customer_id: uuid.nullable().optional(),
  cash_customer_name: z.string().trim().max(150).nullable().optional(),
  sale_date: z.iso.datetime({ offset: true }).optional(),
  items: z.array(saleItemInputSchema).min(1, 'أضف صنفًا واحدًا على الأقل'),
  invoice_discount: money.default(0),
  paid: money.default(0),
  payment_method: paymentMethodSchema.nullable().optional(),
  notes: optionalText,
  allow_over_credit: z.boolean().optional(),
  held_id: uuid.nullable().optional(),
});
export type SaleInput = z.infer<typeof saleInputSchema>;

// ---------------------------------------------------------------------
// الشراء
// ---------------------------------------------------------------------
export const purchaseItemInputSchema = z.object({
  product_id: uuid,
  unit: unitKindSchema,
  qty,
  unit_cost: money,
});

export const purchaseInputSchema = z.object({
  supplier_id: uuid,
  purchase_date: z.iso.datetime({ offset: true }).optional(),
  supplier_invoice_no: optionalText,
  items: z.array(purchaseItemInputSchema).min(1, 'أضف صنفًا واحدًا على الأقل'),
  paid: money.default(0),
  payment_method: paymentMethodSchema.nullable().optional(),
  notes: optionalText,
});
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

// ---------------------------------------------------------------------
// المرتجع
// ---------------------------------------------------------------------
export const returnItemInputSchema = z.object({
  sale_item_id: uuid,
  unit: unitKindSchema,
  qty,
  unit_price: money.optional(),
  condition: itemConditionSchema.default('good'),
});

export const returnInputSchema = z.object({
  sale_id: uuid,
  return_date: z.iso.datetime({ offset: true }).optional(),
  items: z.array(returnItemInputSchema).min(1, 'حدد صنفًا واحدًا على الأقل'),
  refund_cash: money.default(0),
  refund_method: paymentMethodSchema.nullable().optional(),
  reason: optionalText,
  notes: optionalText,
});
export type ReturnInput = z.infer<typeof returnInputSchema>;

// ---------------------------------------------------------------------
// الدفعات
// ---------------------------------------------------------------------
export const customerPaymentSchema = z.object({
  customer_id: uuid,
  amount: moneyPositive,
  method: paymentMethodSchema.default('cash'),
  sale_id: uuid.nullable().optional(),
  payment_date: z.iso.datetime({ offset: true }).optional(),
  notes: optionalText,
});
export type CustomerPaymentInput = z.infer<typeof customerPaymentSchema>;

export const supplierPaymentSchema = z.object({
  supplier_id: uuid,
  amount: moneyPositive,
  method: paymentMethodSchema.default('cash'),
  purchase_id: uuid.nullable().optional(),
  payment_date: z.iso.datetime({ offset: true }).optional(),
  notes: optionalText,
});
export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;

// ---------------------------------------------------------------------
// المصروفات وحركات الصندوق
// ---------------------------------------------------------------------
export const expenseSchema = z.object({
  category_id: uuid,
  amount: moneyPositive,
  method: paymentMethodSchema.default('cash'),
  expense_date: z.iso.datetime({ offset: true }).optional(),
  notes: optionalText,
  attachment_url: optionalText,
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const cashManualSchema = z.object({
  tx_type: z.enum(['extra_income', 'owner_withdrawal', 'deposit', 'adjustment']),
  direction: z.enum(['in', 'out']).optional(),
  amount: moneyPositive,
  method: paymentMethodSchema.default('cash'),
  tx_date: z.iso.datetime({ offset: true }).optional(),
  notes: optionalText,
});
export type CashManualInput = z.infer<typeof cashManualSchema>;

export const closeSessionSchema = z.object({
  session_date: z.iso.date().optional(),
  actual_cash: money,
  notes: optionalText,
});
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

// ---------------------------------------------------------------------
// الأصناف والأقسام
// ---------------------------------------------------------------------
export const productSchema = z.object({
  name: z.string().trim().min(1, 'اسم الصنف مطلوب').max(200),
  barcode: optionalText,
  sku: optionalText,
  category_id: uuid.nullable().optional(),
  brand: optionalText,
  description: optionalText,
  notes: optionalText,
  image_url: optionalText,
  units_per_carton: z.number().int().min(1, 'عدد الحبات في الكرتونة 1 على الأقل'),
  purchase_price_carton: money.default(0),
  sale_price_carton: money.default(0),
  sale_price_piece: money.default(0),
  wholesale_price_carton: money.nullable().optional(),
  wholesale_price_piece: money.nullable().optional(),
  min_stock_units: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
});
export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'اسم القسم مطلوب').max(100),
  sort_order: z.number().int().default(0),
});

// ---------------------------------------------------------------------
// العملاء والموردون
// ---------------------------------------------------------------------
export const customerSchema = z.object({
  name: z.string().trim().min(1, 'اسم العميل مطلوب').max(150),
  shop_name: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  area: optionalText,
  address: optionalText,
  notes: optionalText,
  credit_limit: money.nullable().optional(),
  is_active: z.boolean().default(true),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'اسم المورد مطلوب').max(150),
  company_name: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  area: optionalText,
  address: optionalText,
  notes: optionalText,
  is_active: z.boolean().default(true),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const customerPriceSchema = z.object({
  customer_id: uuid,
  product_id: uuid,
  unit: unitKindSchema,
  price: money,
});

// ---------------------------------------------------------------------
// الجرد وتعديل المخزون
// ---------------------------------------------------------------------
export const adjustStockSchema = z.object({
  product_id: uuid,
  mode: z.enum(['set', 'delta']),
  qty_units: z.number().int(),
  reason: z.string().trim().min(2, 'سبب التعديل مطلوب'),
});

export const startCountSchema = z.object({
  count_type: z.enum(['daily', 'monthly', 'manual']).default('manual'),
  category_id: uuid.nullable().optional(),
  notes: optionalText,
});

export const setCountItemSchema = z.object({
  count_id: uuid,
  product_id: uuid,
  actual_units: z.number().int().nonnegative().nullable(),
});

// ---------------------------------------------------------------------
// الدفتر اليومي
// ---------------------------------------------------------------------
export const noteSchema = z.object({
  content: z.string().trim().min(1, 'اكتب الملاحظة').max(4000),
  is_task: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
});

// ---------------------------------------------------------------------
// الإلغاء
// ---------------------------------------------------------------------
export const voidSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(2, 'سبب الإلغاء مطلوب').max(500),
});
