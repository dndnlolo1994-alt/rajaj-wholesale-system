import type { UnitKind } from '@/lib/types/db';

// المخزون داخليًا دائمًا بالحبة. العرض للمستخدم: كراتين + حبات.

/** تحويل كمية بوحدة بيع إلى حبات */
export function toBaseUnits(qty: number, unit: UnitKind, unitsPerCarton: number): number {
  return unit === 'carton' ? qty * unitsPerCarton : qty;
}

/** تفكيك عدد الحبات إلى كراتين وحبات */
export function splitUnits(units: number, unitsPerCarton: number): { cartons: number; pieces: number } {
  const upc = Math.max(1, unitsPerCarton);
  const sign = units < 0 ? -1 : 1;
  const abs = Math.abs(units);
  return { cartons: sign * Math.floor(abs / upc), pieces: sign * (abs % upc) };
}

/** "5 كرتونة + 7 حبة" — عرض عربي واضح للكمية */
export function formatQty(units: number, unitsPerCarton: number): string {
  if (units === 0) return '0';
  const upc = Math.max(1, unitsPerCarton);
  const negative = units < 0;
  const abs = Math.abs(units);
  const cartons = Math.floor(abs / upc);
  const pieces = abs % upc;
  const parts: string[] = [];
  if (cartons > 0 || upc === 1) parts.push(`${cartons} كرتونة`);
  if (pieces > 0) parts.push(`${pieces} حبة`);
  if (parts.length === 0) parts.push('0');
  return (negative ? '−' : '') + parts.join(' + ');
}

export const unitLabel: Record<UnitKind, string> = {
  carton: 'كرتونة',
  piece: 'حبة',
};

/** سعر الحبة المشتق من سعر الكرتونة */
export function derivePiecePrice(cartonPrice: number, unitsPerCarton: number): number {
  if (unitsPerCarton <= 0) return cartonPrice;
  return Math.round((cartonPrice / unitsPerCarton) * 1000) / 1000;
}
