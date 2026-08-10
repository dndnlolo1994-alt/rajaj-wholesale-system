import type { PaymentMethod } from '@/lib/types/db';

/** أنواع وقيم إعدادات آمنة للاستخدام في الخادم والمتصفح. */
export interface BusinessSettings {
  owner_name: string;
  business_name: string;
  phone: string;
  address: string;
  logo_url: string | null;
  invoice_footer: string;
}

export interface PrinterSettings {
  paper_width: 58 | 80;
  mode: 'browser' | 'bridge';
  bridge_url: string;
  printer_ip: string;
  printer_port: number;
  copies: number;
  auto_print: boolean;
  printer_name: string;
  cut: boolean;
  cash_drawer: boolean;
}

export interface AppSettings {
  business: BusinessSettings;
  general: { timezone: string; currency_code: string; currency_symbol: string; currency_decimals: number };
  invoice: {
    prefix: string; purchase_prefix: string; return_prefix: string;
    receipt_prefix: string; voucher_prefix: string; expense_prefix: string; count_prefix: string;
  };
  sales: { default_payment_method: PaymentMethod; big_invoice_threshold: number };
  inventory: { allow_negative_stock: boolean; stagnant_days: number };
  debts: { old_debt_days: number; critical_debt_days: number };
  cashbox: { opening_balance: number };
  printer: PrinterSettings;
  backup: { auto_enabled: boolean; retention_days: number };
}

export const DEFAULT_SETTINGS: AppSettings = {
  business: {
    owner_name: 'رجائي المصري',
    business_name: 'مؤسسة رجائي المصري للتوزيع والجملة',
    phone: '',
    address: '',
    logo_url: null,
    invoice_footer: 'شكرًا لتعاملكم معنا',
  },
  general: { timezone: 'Asia/Amman', currency_code: 'JOD', currency_symbol: 'د.أ', currency_decimals: 3 },
  invoice: {
    prefix: 'RM', purchase_prefix: 'PUR', return_prefix: 'RET',
    receipt_prefix: 'RCV', voucher_prefix: 'PAY', expense_prefix: 'EXP', count_prefix: 'CNT',
  },
  sales: { default_payment_method: 'cash', big_invoice_threshold: 500 },
  inventory: { allow_negative_stock: false, stagnant_days: 45 },
  debts: { old_debt_days: 30, critical_debt_days: 60 },
  cashbox: { opening_balance: 0 },
  printer: {
    paper_width: 80, mode: 'browser', bridge_url: 'http://127.0.0.1:9723',
    printer_ip: '', printer_port: 9100, copies: 1, auto_print: false,
    printer_name: '', cut: true, cash_drawer: false,
  },
  backup: { auto_enabled: true, retention_days: 30 },
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  wallet: 'محفظة إلكترونية',
  cheque: 'شيك',
  other: 'أخرى',
};
