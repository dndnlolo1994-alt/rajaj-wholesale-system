'use server';

import { createClient } from '@/lib/supabase/server';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';

export interface PosProduct {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  brand: string | null;
  units_per_carton: number;
  stock_units: number;
  min_stock_units: number;
  sale_price_carton: number;
  sale_price_piece: number;
  wholesale_price_carton: number | null;
  wholesale_price_piece: number | null;
  special_price_carton: number | null;
  special_price_piece: number | null;
}

export async function posProductsAction(params: {
  q?: string;
  category_id?: string | null;
  customer_id?: string | null;
  offset?: number;
}): Promise<ActionResult<PosProduct[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('pos_products', {
      p_q: params.q ?? null,
      p_category_id: params.category_id ?? null,
      p_customer_id: params.customer_id ?? null,
      p_limit: 40,
      p_offset: params.offset ?? 0,
    });
    if (error) return actionErr(error);
    return actionOk((data ?? []) as PosProduct[]);
  } catch (e) {
    return actionErr(e);
  }
}

export async function barcodeLookupAction(code: string, customerId?: string | null): Promise<ActionResult<PosProduct | null>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('product_lookup_barcode', {
      p_code: code,
      p_customer_id: customerId ?? null,
    });
    if (error) return actionErr(error);
    return actionOk((data as PosProduct | null) ?? null);
  } catch (e) {
    return actionErr(e);
  }
}

export interface CustomerFavorite {
  id: string;
  name: string;
  total_units: number;
  times_bought: number;
  last_bought_at: string;
  last_purchase: { unit: 'carton' | 'piece'; unit_price: number; sale_date: string } | null;
  units_per_carton: number;
  stock_units: number;
  sale_price_carton: number;
  sale_price_piece: number;
  barcode: string | null;
  is_active: boolean;
}

export async function customerFavoritesAction(customerId: string): Promise<ActionResult<CustomerFavorite[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('customer_top_products', {
      p_customer_id: customerId,
      p_limit: 8,
    });
    if (error) return actionErr(error);
    return actionOk((data ?? []) as CustomerFavorite[]);
  } catch (e) {
    return actionErr(e);
  }
}

export interface QuickCustomer {
  id: string;
  name: string;
  shop_name: string | null;
  phone: string | null;
  area: string | null;
  balance: number;
  credit_limit: number | null;
}

export async function quickCustomersAction(q?: string): Promise<ActionResult<QuickCustomer[]>> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('customers')
      .select('id, name, shop_name, phone, area, balance, credit_limit')
      .eq('is_active', true)
      .order('name')
      .limit(30);
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      query = query.or(`name.ilike.${like},shop_name.ilike.${like},phone.like.${like}`);
    }
    const { data, error } = await query;
    if (error) return actionErr(error);
    return actionOk((data ?? []) as QuickCustomer[]);
  } catch (e) {
    return actionErr(e);
  }
}
