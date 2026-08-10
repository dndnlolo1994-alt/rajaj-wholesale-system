// أنواع قاعدة البيانات — مرآة يدوية للمخطط في supabase/migrations
// الكميات المخزنية دائمًا بالحبة (أصغر وحدة). المبالغ بالدينار (3 منازل).

export type UserRole = 'owner' | 'manager' | 'sales' | 'warehouse' | 'accountant';
export type DocStatus = 'completed' | 'void';
export type UnitKind = 'carton' | 'piece';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'wallet' | 'cheque' | 'other';
export type PartyType = 'customer' | 'supplier';
export type LedgerEntryType = 'opening' | 'sale' | 'purchase' | 'payment' | 'return' | 'adjustment' | 'void';
export type StockMoveType =
  | 'purchase' | 'sale' | 'sale_return' | 'sale_void'
  | 'purchase_void' | 'return_void' | 'adjustment' | 'count_adjustment';
export type CashTxType =
  | 'sale_receipt' | 'customer_receipt' | 'supplier_payment' | 'expense'
  | 'extra_income' | 'owner_withdrawal' | 'deposit' | 'adjustment' | 'refund';
export type CashDirection = 'in' | 'out';
export type ItemCondition = 'good' | 'damaged';
export type CountStatus = 'open' | 'completed' | 'cancelled';
export type CountType = 'daily' | 'monthly' | 'manual';
export type NotifSeverity = 'info' | 'warning' | 'critical';
export type BackupStatus = 'running' | 'success' | 'failed';
export type BackupType = 'manual' | 'auto' | 'export';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  category_id: string | null;
  brand: string | null;
  description: string | null;
  notes: string | null;
  image_url: string | null;
  units_per_carton: number;
  stock_units: number;
  avg_unit_cost: number;
  purchase_price_carton: number;
  sale_price_carton: number;
  sale_price_piece: number;
  wholesale_price_carton: number | null;
  wholesale_price_piece: number | null;
  min_stock_units: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  shop_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  area: string | null;
  address: string | null;
  notes: string | null;
  credit_limit: number | null;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  area: string | null;
  address: string | null;
  notes: string | null;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerPrice {
  id: string;
  customer_id: string;
  product_id: string;
  unit: UnitKind;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  cash_customer_name: string | null;
  status: DocStatus;
  sale_date: string;
  subtotal: number;
  line_discount_total: number;
  invoice_discount: number;
  total: number;
  paid: number;
  remaining: number;
  cost_total: number;
  profit: number;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  unit: UnitKind;
  units_per_carton: number;
  qty: number;
  qty_units: number;
  unit_price: number;
  line_total: number;
  discount: number;
  inv_discount_share: number;
  net_total: number;
  unit_cost: number;
  cost_total: number;
  profit: number;
  created_at: string;
}

export interface HeldSale {
  id: string;
  label: string | null;
  customer_id: string | null;
  payload: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  invoice_no: string;
  supplier_invoice_no: string | null;
  supplier_id: string;
  status: DocStatus;
  purchase_date: string;
  total: number;
  paid: number;
  remaining: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  unit: UnitKind;
  units_per_carton: number;
  qty: number;
  qty_units: number;
  unit_cost: number;
  cost_per_unit: number;
  line_total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  payment_no: string;
  party_type: PartyType;
  customer_id: string | null;
  supplier_id: string | null;
  sale_id: string | null;
  purchase_id: string | null;
  direction: CashDirection;
  amount: number;
  method: PaymentMethod;
  status: DocStatus;
  payment_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface CustomerLedgerEntry {
  id: number;
  customer_id: string;
  entry_type: LedgerEntryType;
  ref_table: string | null;
  ref_id: string | null;
  debit: number;
  credit: number;
  balance_after: number;
  entry_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SupplierLedgerEntry {
  id: number;
  supplier_id: string;
  entry_type: LedgerEntryType;
  ref_table: string | null;
  ref_id: string | null;
  debit: number;
  credit: number;
  balance_after: number;
  entry_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockMovement {
  id: number;
  product_id: string;
  move_type: StockMoveType;
  qty_change: number;
  balance_after: number;
  unit_cost: number | null;
  ref_table: string | null;
  ref_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Return {
  id: string;
  return_no: string;
  sale_id: string;
  customer_id: string | null;
  status: DocStatus;
  return_date: string;
  total: number;
  restocked_cost_total: number;
  profit_delta: number;
  refund_cash: number;
  refund_method: PaymentMethod | null;
  reason: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string | null;
  product_id: string;
  product_name: string;
  unit: UnitKind;
  units_per_carton: number;
  qty: number;
  qty_units: number;
  unit_price: number;
  line_total: number;
  condition: ItemCondition;
  unit_cost: number;
  cost_total: number;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Expense {
  id: string;
  expense_no: string;
  category_id: string;
  amount: number;
  method: PaymentMethod;
  status: DocStatus;
  expense_date: string;
  notes: string | null;
  attachment_url: string | null;
  created_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface CashTransaction {
  id: number;
  tx_type: CashTxType;
  direction: CashDirection;
  amount: number;
  method: PaymentMethod;
  ref_table: string | null;
  ref_id: string | null;
  tx_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CashSession {
  id: string;
  session_date: string;
  opening_balance: number;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
  actual_cash: number;
  difference: number;
  status: 'open' | 'closed';
  notes: string | null;
  closed_by: string | null;
  closed_at: string;
  created_at: string;
}

export interface InventoryCount {
  id: string;
  count_no: string;
  count_type: CountType;
  status: CountStatus;
  category_id: string | null;
  notes: string | null;
  items_total: number;
  counted_items: number;
  total_diff_units: number;
  total_diff_value: number;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
}

export interface InventoryCountItem {
  id: number;
  count_id: string;
  product_id: string;
  product_name: string;
  barcode: string | null;
  expected_units: number;
  actual_units: number | null;
  diff_units: number | null;
  unit_cost: number;
  diff_value: number | null;
  counted_at: string | null;
}

export interface Note {
  id: string;
  content: string;
  is_task: boolean;
  is_done: boolean;
  is_pinned: boolean;
  note_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  type: string;
  severity: NotifSeverity;
  title: string;
  body: string | null;
  ref_table: string | null;
  ref_id: string | null;
  dedupe_key: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  ip: string | null;
  created_at: string;
}

export interface BackupLog {
  id: string;
  backup_type: BackupType;
  status: BackupStatus;
  file_name: string | null;
  file_size: number | null;
  storage_path: string | null;
  tables_count: number | null;
  rows_count: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  created_by: string | null;
}

export interface AppSetting {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
}
