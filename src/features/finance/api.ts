import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type FinanceCategory = Tables<'finance_categories'>;
export type FinanceEntry = Tables<'finance_entries'>;
export type FinanceAccount = Tables<'finance_accounts'>;
export type AccountBalance = Tables<'v_account_balances'>;
export type PurchaseInvoice = Tables<'purchase_invoices'>;

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['finance'] });
}

export function useFinanceCategories() {
  return useQuery({
    queryKey: ['finance', 'categories'],
    staleTime: 5 * 60_000,
    queryFn: async () => unwrap(await supabase.from('finance_categories').select('*').order('sort')),
  });
}

export function useSaveCategory() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (row: TablesInsert<'finance_categories'>) =>
      unwrap(await supabase.from('finance_categories').upsert(row).select('code').single()),
    onSuccess: inv,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ['finance', 'balances'],
    queryFn: async () => unwrap(await supabase.from('v_account_balances').select('*').order('name')),
  });
}

/** Defter satırları (tarih aralığı, dahil) */
export function useEntries(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['finance', 'entries', from, to],
    enabled,
    queryFn: async () => unwrap(await supabase.from('finance_entries').select('*')
      .gte('entry_date', from).lte('entry_date', to).order('entry_date', { ascending: false }).order('created_at', { ascending: false })),
  });
}

/** Nakit hareketleri: ödenmiş kayıtlar, ödeme tarihine (yoksa kayıt tarihine) göre `from` sonrası */
export function useCashMovements(from: string) {
  return useQuery({
    queryKey: ['finance', 'cash', from],
    queryFn: async () => unwrap(await supabase.from('finance_entries').select('*').eq('status', 'odendi')
      .or(`paid_at.gte.${from},and(paid_at.is.null,entry_date.gte.${from})`)),
  });
}

/** Açık alacak/borçlar (tarih bağımsız) */
export function useOpenItems(enabled = true) {
  return useQuery({
    queryKey: ['finance', 'open'],
    enabled,
    queryFn: async () => unwrap(await supabase.from('finance_entries').select('*').eq('status', 'bekliyor').order('due_date')),
  });
}

export function useSaveEntry() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: TablesInsert<'finance_entries'> | TablesUpdate<'finance_entries'> }) => {
      if (id) return unwrap(await supabase.from('finance_entries').update(draft).eq('id', id).select('id').single()).id;
      return unwrap(await supabase.from('finance_entries').insert(draft as TablesInsert<'finance_entries'>).select('id').single()).id;
    },
    onSuccess: inv,
  });
}

export function useDeleteEntry() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = unwrap(await supabase.from('finance_entries').delete().eq('id', id).select('id'));
      if (rows.length === 0) throw { code: '42501' };
    },
    onSuccess: inv,
  });
}

// ------------------------------------------------------------------ Gelen faturalar
export function useInvoices(from: string, to: string) {
  return useQuery({
    queryKey: ['finance', 'invoices', from, to],
    queryFn: async () => unwrap(await supabase.from('purchase_invoices').select('*')
      .gte('invoice_date', from).lte('invoice_date', to).order('invoice_date', { ascending: false })),
  });
}

export function useSupplierMemory() {
  return useQuery({
    queryKey: ['finance', 'supplier_memory'],
    queryFn: async () => unwrap(await supabase.from('supplier_categories').select('supplier_key, category_code')),
  });
}

export function useSaveInvoice() {
  const inv = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: TablesInsert<'purchase_invoices'> | TablesUpdate<'purchase_invoices'> }) => {
      if (id) return unwrap(await supabase.from('purchase_invoices').update(draft).eq('id', id).select('id').single()).id;
      return unwrap(await supabase.from('purchase_invoices').insert(draft as TablesInsert<'purchase_invoices'>).select('id').single()).id;
    },
    onSuccess: () => Promise.all([inv(), qc.invalidateQueries({ queryKey: ['ingredients'] })]),
  });
}

export function useDeleteInvoice() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = unwrap(await supabase.from('purchase_invoices').delete().eq('id', id).select('id'));
      if (rows.length === 0) throw { code: '42501' };
    },
    onSuccess: inv,
  });
}
