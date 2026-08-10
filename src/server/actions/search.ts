'use server';

import { createClient } from '@/lib/supabase/server';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';

export interface GlobalSearchResults {
  customers: { id: string; name: string; shop_name: string | null; phone: string | null; balance: number }[];
  suppliers: { id: string; name: string; company_name: string | null; phone: string | null; balance: number }[];
  products: {
    id: string; name: string; barcode: string | null; stock_units: number;
    units_per_carton: number; sale_price_carton: number; sale_price_piece: number;
  }[];
  sales: { id: string; invoice_no: string; total: number; status: string; sale_date: string; customer_name: string }[];
}

export async function globalSearchAction(q: string): Promise<ActionResult<GlobalSearchResults>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('global_search', { p_q: q, p_limit: 6 });
    if (error) return actionErr(error);
    return actionOk(data as GlobalSearchResults);
  } catch (e) {
    return actionErr(e);
  }
}
