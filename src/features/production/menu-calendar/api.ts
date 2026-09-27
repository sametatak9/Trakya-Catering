import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { planToRows, type Plan } from './rules';

export type MonthlyMenu = Tables<'monthly_menus'>;
export type MonthlyDay = Tables<'monthly_menu_days'>;
export type MenuKind = '3_kap' | '4_kap' | 'kahvalti' | 'diyet' | 'ozel';
export const MENU_KIND_LABELS: Record<MenuKind, string> = { '3_kap': '3 kap', '4_kap': '4 kap', kahvalti: 'Kahvaltı', diyet: 'Diyet', ozel: 'Özel' };
export const MONTHLY_STATUS: Record<string, { label: string; tone: 'idle' | 'wait' | 'ok' | 'info' }> = {
  taslak: { label: 'Taslak', tone: 'idle' }, onay: { label: 'Onayda', tone: 'wait' }, yayinda: { label: 'Yayında', tone: 'ok' }, arsiv: { label: 'Arşiv', tone: 'info' },
};

const firstDay = (period: string) => `${period}-01`;
const qkMenus = (period: string, customerId: string | null, kind: MenuKind) => ['monthly', period, customerId ?? 'genel', kind];

/** Ayın tüm sürümleri (en yeni önce) */
export function useMonthlyMenus(period: string, customerId: string | null, kind: MenuKind) {
  return useQuery({
    queryKey: qkMenus(period, customerId, kind),
    queryFn: async () => {
      let q = supabase.from('monthly_menus').select('*').eq('period', firstDay(period)).eq('kind', kind).order('version', { ascending: false });
      q = customerId ? q.eq('customer_id', customerId) : q.is('customer_id', null);
      return unwrap(await q);
    },
  });
}

export function useMonthlyDays(menuId: string | null | undefined) {
  return useQuery({
    queryKey: ['monthly-days', menuId],
    enabled: !!menuId,
    queryFn: async () => unwrap(await supabase.from('monthly_menu_days').select('*').eq('monthly_menu_id', menuId!)),
  });
}

/** Önceki ayın (varsa yayındaki, yoksa en yeni) içeriği — "geçen aydan başlat" */
export async function fetchPreviousMonth(prevPeriod: string, customerId: string | null, kind: MenuKind): Promise<MonthlyDay[]> {
  let q = supabase.from('monthly_menus').select('id, status, version').eq('period', firstDay(prevPeriod)).eq('kind', kind).order('version', { ascending: false });
  q = customerId ? q.eq('customer_id', customerId) : q.is('customer_id', null);
  const menus = unwrap(await q);
  const pick = menus.find((m) => m.status === 'yayinda') ?? menus[0];
  if (!pick) return [];
  return unwrap(await supabase.from('monthly_menu_days').select('*').eq('monthly_menu_id', pick.id));
}

export function useRecipeTags() {
  return useQuery({ queryKey: ['t', 'recipe_tags'], queryFn: async () => unwrap(await supabase.from('recipe_tags').select('*')) });
}

export function useDishRules(customerId: string | null) {
  return useQuery({
    queryKey: ['t', 'customer_dish_rules', customerId],
    enabled: !!customerId,
    queryFn: async () => unwrap(await supabase.from('customer_dish_rules').select('*').eq('customer_id', customerId!).eq('active', true)),
  });
}

/** Planı kaydeder: sürüm yoksa açar; yayındaki/arşivdeki sürüm değiştirilemez → yeni sürüm (§3.8). Dönen: menü id */
export function useSaveMonthlyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { period: string; customerId: string | null; kind: MenuKind; current: MonthlyMenu | null; plan: Plan; notes?: string | null }) => {
      let menu = a.current;
      if (!menu || menu.status === 'yayinda' || menu.status === 'arsiv') {
        menu = unwrap(await supabase.from('monthly_menus').insert({
          period: firstDay(a.period), customer_id: a.customerId, kind: a.kind, version: (a.current?.version ?? 0) + 1, status: 'taslak', notes: a.notes ?? null,
        }).select('*').single());
      }
      unwrap(await supabase.from('monthly_menu_days').delete().eq('monthly_menu_id', menu.id).select('id'));
      const rows = planToRows(a.plan, menu.id);
      for (let i = 0; i < rows.length; i += 500) unwrap(await supabase.from('monthly_menu_days').insert(rows.slice(i, i + 500)).select('id'));
      return menu.id;
    },
    onSuccess: (_id, a) => Promise.all([
      qc.invalidateQueries({ queryKey: qkMenus(a.period, a.customerId, a.kind) }),
      qc.invalidateQueries({ queryKey: ['monthly-days'] }),
    ]),
  });
}

export interface PublishResult { ok: boolean; slots?: number; violations?: Array<{ day: string | null; meal: string | null; recipe_id: string | null; rule: string; detail: string }> }

export function usePublishMonthly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('publish_monthly_menu', { p_id: id })) as unknown as PublishResult,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['monthly'] }), qc.invalidateQueries({ queryKey: ['menu-plans'] }), qc.invalidateQueries({ queryKey: ['t', 'menu_plans'] })]),
  });
}

export function useSetMonthlyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; status: 'taslak' | 'onay' }) => unwrap(await supabase.from('monthly_menus').update({ status: a.status }).eq('id', a.id).select('id').single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monthly'] }),
  });
}
