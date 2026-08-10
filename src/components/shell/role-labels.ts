import type { UserRole } from '@/lib/types/db';

export const roleLabelsClient: Record<UserRole, string> = {
  owner: 'المالك',
  manager: 'مدير',
  sales: 'موظف مبيعات',
  warehouse: 'موظف مستودع',
  accountant: 'محاسب',
};
