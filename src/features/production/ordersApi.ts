import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type ProductionOrder = Tables<'production_orders'>;
export type RecipeCalibration = Tables<'recipe_calibrations'>;
export type WorkOrder = Tables<'work_orders'>;

const productionKeys = {
  order: (date: string, meal: string) => ['production_order', date, meal] as const,
  workOrders: (id: string) => ['work_orders', id] as const,
  calibrations: (id: string) => ['recipe_calibrations', id] as const,
};

function useInvalidateProduction() {
  const qc = useQueryClient();
  return async (id?: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['production_order'] }),
      qc.invalidateQueries({ queryKey: ['work_orders'] }),
      qc.invalidateQueries({ queryKey: ['prep'] }),
      qc.invalidateQueries({ queryKey: ['orders'] }),
      qc.invalidateQueries({ queryKey: ['finance'] }),
      qc.invalidateQueries({ queryKey: ['recipe_costs'] }),
      qc.invalidateQueries({ queryKey: ['recipe_lines'] }),
      qc.invalidateQueries({ queryKey: ['menu_costs'] }),
      ...(id ? [qc.invalidateQueries({ queryKey: productionKeys.calibrations(id) })] : []),
    ]);
  };
}

export function useProductionOrder(date: string, meal: string) {
  return useQuery({
    queryKey: productionKeys.order(date, meal),
    queryFn: async () => unwrap(await supabase.from('production_orders').select('*')
      .eq('prod_date', date).eq('meal', meal).maybeSingle()),
  });
}

export function useBuildProductionOrder() {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: async ({ date, meal }: { date: string; meal: string }) =>
      unwrap(await supabase.rpc('po_build', { p_date: date, p_meal: meal })),
    onSuccess: () => invalidate(),
  });
}

export function useCheckProductionOrder() {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('po_check', { p_id: id })),
    onSuccess: () => invalidate(),
  });
}

export function useApproveProductionOrder() {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: async ({ id, force, note }: { id: string; force: boolean; note: string | null }) =>
      unwrap(await supabase.rpc('po_approve', { p_id: id, p_force: force, p_note: note ?? undefined })),
    onSuccess: () => invalidate(),
  });
}

export function useCloseProductionOrder() {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: async ({ id, deliver }: { id: string; deliver: boolean }) =>
      unwrap(await supabase.rpc('po_close', { p_id: id, p_deliver: deliver })),
    onSuccess: () => invalidate(),
  });
}

export function useWorkOrders(productionOrderId: string | null) {
  return useQuery({
    queryKey: productionKeys.workOrders(productionOrderId ?? ''),
    enabled: Boolean(productionOrderId),
    queryFn: async () => unwrap(await supabase.from('work_orders')
      .select('id, production_order_id, meal, revision, snapshot, print_count, printed_at, created_at, created_by')
      .eq('production_order_id', productionOrderId!).order('revision', { ascending: false }).limit(5)),
  });
}

export function useRecordWorkOrderPrint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workOrder: Pick<WorkOrder, 'id' | 'production_order_id' | 'print_count'>) => {
      unwrap(await supabase.from('work_orders').update({ print_count: workOrder.print_count + 1, printed_at: new Date().toISOString() })
        .eq('id', workOrder.id).select('id').single());
      return workOrder.production_order_id;
    },
    onSuccess: (id) => qc.invalidateQueries({ queryKey: ['work_orders', id] }),
  });
}

export function useRecipeCalibrations(recipeId: string | null) {
  return useQuery({
    queryKey: productionKeys.calibrations(recipeId ?? ''),
    enabled: Boolean(recipeId),
    queryFn: async () => unwrap(await supabase.from('recipe_calibrations').select('*')
      .eq('recipe_id', recipeId!).order('prep_date', { ascending: false }).limit(120)),
  });
}

export function useSetCalibrationIncluded() {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: async ({ id, recipeId, included }: { id: string; recipeId: string; included: boolean }) => {
      unwrap(await supabase.from('recipe_calibrations').update({
        included, reason: included ? null : 'elle',
      }).eq('id', id).select('id').single());
      return recipeId;
    },
    onSuccess: (id) => invalidate(id),
  });
}

export function useApplyCalibration() {
  const invalidate = useInvalidateProduction();
  return useMutation({
    mutationFn: async (recipeId: string) => {
      // Existing server recalibration excludes rows explicitly marked 'elle', recomputes the
      // weighted median, updates automatic recipes, and stores the suggestion before apply.
      await unwrap(await supabase.rpc('recalibrate_recipe', { p_recipe_id: recipeId }));
      return unwrap(await supabase.rpc('apply_calibration', { p_recipe_id: recipeId }));
    },
    onSuccess: (_count, recipeId) => invalidate(recipeId),
    onError: (_error, recipeId) => invalidate(recipeId),
  });
}
