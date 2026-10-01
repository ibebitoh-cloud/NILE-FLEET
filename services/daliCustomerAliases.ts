import { supabase } from './supabaseClient';

export type DaliCustomerAlias = {
  id: string;
  customer_id: string;
  alias: string;
  normalized_alias: string;
  alias_type: 'arabic' | 'nickname' | 'typo' | 'manual';
  source: string;
  active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeDaliCustomerAlias(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function getDaliCustomerAliases(): Promise<DaliCustomerAlias[]> {
  const { data, error } = await supabase
    .from('dali_customer_aliases')
    .select('*')
    .eq('active', true)
    .order('customer_id')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`DALI customer dictionary load failed: ${error.message}`);
  return (data || []) as DaliCustomerAlias[];
}

export async function saveDaliCustomerAlias(input: {
  customerId: string;
  alias: string;
  aliasType?: DaliCustomerAlias['alias_type'];
}): Promise<DaliCustomerAlias> {
  const alias = String(input.alias || '').trim();
  const normalized = normalizeDaliCustomerAlias(alias);
  if (!input.customerId) throw new Error('Customer is required');
  if (normalized.length < 2) throw new Error('Customer alias is too short');

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) throw new Error('No active user');

  const { data, error } = await supabase
    .from('dali_customer_aliases')
    .upsert({
      customer_id: input.customerId,
      alias,
      normalized_alias: normalized,
      alias_type: input.aliasType || 'manual',
      source: input.aliasType === 'arabic' ? 'Manual Arabic customer training' : 'DALI Customer Dictionary',
      active: true,
      created_by: auth.user.id,
    }, { onConflict: 'customer_id,normalized_alias' })
    .select('*')
    .single();

  if (error) throw new Error(`DALI customer alias save failed: ${error.message}`);
  return data as DaliCustomerAlias;
}

export async function deleteDaliCustomerAlias(id: string): Promise<void> {
  const { error } = await supabase
    .from('dali_customer_aliases')
    .update({ active: false })
    .eq('id', id);
  if (error) throw new Error(`DALI customer alias delete failed: ${error.message}`);
}
