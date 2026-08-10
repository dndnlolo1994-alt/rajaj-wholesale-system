import type { UserRole } from '@/lib/types/db';

/** من يرى الأرباح والتكاليف (لا تظهر أبدًا لموظفي المبيعات والمستودع) */
export function canSeeProfit(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'accountant';
}

export function canManage(role: UserRole): boolean {
  return role === 'owner' || role === 'manager';
}

export function isOwner(role: UserRole): boolean {
  return role === 'owner';
}
