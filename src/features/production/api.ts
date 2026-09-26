import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type PrepBatchCost = Tables<'v_prep_batch_costs'>;
export type PrepItem = Tables<'v_prep_items'>;
export type MenuPlan = Tables<'menu_plans'>;

/** Hazırlık başlıkları (maliyet özetiyle), tarih aralığı dahil */
export function usePrepBatches(from: string, to: string = from) {
  return useQuery({
    queryKey: ['prep', 'batches', from, to],
    queryFn: async () => unwrap(await supabase.from('v_prep_batch_costs').select('*')
      .gte('prep_date', from).lte('prep_date', to).order('prep_date').order('dish_name')),
  });
}

export function usePrepItems(batchIds: string[]) {
  return useQuery({
    queryKey: ['prep', 'items', [...batchIds].sort().join(',')],
    enabled: batchIds.length > 0,
    queryFn: async () => unwrap(await supabase.from('v_prep_items').select('*').in('batch_id', batchIds).order('sort').order('created_at')),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['prep'] }),
    qc.invalidateQueries({ queryKey: ['recipe_costs'] }),
    qc.invalidateQueries({ queryKey: ['recipe_lines'] }),
    qc.invalidateQueries({ queryKey: ['menu_costs'] }),
  ]);
}

export function usePlanPrep() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ date, meal }: { date: string; meal: string }) =>
      unwrap(await supabase.rpc('plan_prep_from_orders', { p_date: date, p_meal: meal })),
    onSuccess: inv,
  });
}

export function useSaveBatch() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: TablesInsert<'prep_batches'> | TablesUpdate<'prep_batches'> }) => {
      if (id) return unwrap(await supabase.from('prep_batches').update(draft).eq('id', id).select('id').single()).id;
      return unwrap(await supabase.from('prep_batches').insert(draft as TablesInsert<'prep_batches'>).select('id').single()).id;
    },
    onSuccess: inv,
  });
}

export function useDeleteBatch() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = unwrap(await supabase.from('prep_batches').delete().eq('id', id).select('id'));
      if (rows.length === 0) throw { code: '42501' };
    },
    onSuccess: inv,
  });
}

export function useSaveItem() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: TablesInsert<'prep_batch_items'> | TablesUpdate<'prep_batch_items'> }) => {
      if (id) return unwrap(await supabase.from('prep_batch_items').update(draft).eq('id', id).select('id').single()).id;
      return unwrap(await supabase.from('prep_batch_items').insert(draft as TablesInsert<'prep_batch_items'>).select('id').single()).id;
    },
    onSuccess: inv,
  });
}

export function useDeleteItem() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = unwrap(await supabase.from('prep_batch_items').delete().eq('id', id).select('id'));
      if (rows.length === 0) throw { code: '42501' };
    },
    onSuccess: inv,
  });
}

export function useFillFromRecipe() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (batchId: string) => unwrap(await supabase.rpc('prep_fill_from_recipe', { p_batch_id: batchId })),
    onSuccess: inv,
  });
}

export function useRecipeFromPrep() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (batchId: string) => unwrap(await supabase.rpc('recipe_from_prep', { p_batch_id: batchId })),
    onSuccess: inv,
  });
}

// ------------------------------------------------------------------ Menü planı
export function useMenuPlans(from: string, to: string = from) {
  return useQuery({
    queryKey: ['menu_plans', from, to],
    queryFn: async () => unwrap(await supabase.from('menu_plans').select('*').gte('plan_date', from).lte('plan_date', to)),
  });
}

export function useSetMenuPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, meal, customerId, menuId }: { date: string; meal: string; customerId: string | null; menuId: string | null }) => {
      let q = supabase.from('menu_plans').delete().eq('plan_date', date).eq('meal', meal);
      q = customerId ? q.eq('customer_id', customerId) : q.is('customer_id', null);
      unwrap(await q.select('id'));
      if (menuId) {
        unwrap(await supabase.from('menu_plans').insert({ plan_date: date, meal, customer_id: customerId, menu_id: menuId }).select('id').single());
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_plans'] }),
  });
}

export function useCopyMenuWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: TablesInsert<'menu_plans'>[]) => {
      if (rows.length === 0) return 0;
      return unwrap(await supabase.from('menu_plans').insert(rows).select('id')).length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_plans'] }),
  });
}

/** Geçerli menü: sipariş menüsü → firma planı → genel plan (veritabanındaki effective_menu ile aynı) */
export function effectiveMenu(plans: MenuPlan[], date: string, meal: string, customerId: string, orderMenu: string | null): string | null {
  return orderMenu
    ?? plans.find((p) => p.plan_date === date && p.meal === meal && p.customer_id === customerId)?.menu_id
    ?? plans.find((p) => p.plan_date === date && p.meal === meal && p.customer_id === null)?.menu_id
    ?? null;
}

/** Menü → kaplar (reçete, katsayı) dizini; menü başı gerçekleşen maliyet için */
export function useMenuItemsIndex() {
  return useQuery({
    queryKey: ['menu_costs', 'items_index'],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('menu_items').select('menu_id, recipe_id, portion_factor, course, sort').order('sort'));
      const m = new Map<string, Array<{ recipe: string; factor: number; course: string }>>();
      for (const r of rows) m.set(r.menu_id, [...(m.get(r.menu_id) ?? []), { recipe: r.recipe_id, factor: Number(r.portion_factor), course: r.course }]);
      return m;
    },
  });
}
