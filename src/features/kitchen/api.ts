import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/lib/database.types';

export type Ingredient = Tables<'ingredients'>;
export type RecipeCost = Tables<'v_recipe_costs'>;
export type RecipeLine = Tables<'v_recipe_lines'>;
export type Recipe = Tables<'recipes'>;
export type RecipeCategory = Tables<'recipe_categories'>;
export type MenuCost = Tables<'v_menu_costs'>;
export type Menu = Tables<'menus'>;
export type MenuItem = Tables<'menu_items'>;
export type IngredientPrice = Tables<'ingredient_prices'>;

// Maliyet zinciri: fiyat → reçete → menü. Bir halka değişince hepsi tazelenir.
export const qk = {
  ingredients: ['ingredients'] as const,
  prices: (id: string) => ['ingredient_prices', id] as const,
  recipeCosts: ['recipe_costs'] as const,
  recipe: (id: string) => ['recipe', id] as const,
  recipeLines: (id: string) => ['recipe_lines', id] as const,
  categories: ['recipe_categories'] as const,
  menuCosts: ['menu_costs'] as const,
  menu: (id: string) => ['menu', id] as const,
};

function useInvalidateCosts() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: qk.ingredients }),
    qc.invalidateQueries({ queryKey: qk.recipeCosts }),
    qc.invalidateQueries({ queryKey: ['recipe_lines'] }),
    qc.invalidateQueries({ queryKey: ['recipe'] }),
    qc.invalidateQueries({ queryKey: qk.menuCosts }),
    qc.invalidateQueries({ queryKey: ['menu'] }),
    qc.invalidateQueries({ queryKey: ['ingredient_prices'] }),
  ]);
}

// ------------------------------------------------------------------ Hammaddeler
export function useIngredients() {
  return useQuery({
    queryKey: qk.ingredients,
    queryFn: async () => unwrap(await supabase.from('ingredients').select('*').order('name')),
  });
}

export function usePriceHistory(ingredientId: string | null) {
  return useQuery({
    queryKey: qk.prices(ingredientId ?? ''),
    enabled: Boolean(ingredientId),
    queryFn: async () => unwrap(await supabase.from('ingredient_prices').select('*')
      .eq('ingredient_id', ingredientId!).order('noted_at', { ascending: false }).limit(20)),
  });
}

export type IngredientDraft = Omit<TablesInsert<'ingredients'>, 'last_price' | 'avg_cost' | 'price_updated_at'>;

export function useSaveIngredient() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: async ({ id, draft, newPrice, supplier }: { id: string | null; draft: IngredientDraft | null; newPrice: number | null; supplier?: string }) => {
      let ingredientId = id;
      // draft null: yalnızca fiyat girişi (muhasebe rolü kartı düzenleyemez)
      if (!draft) {
        if (!id) throw new Error('Yeni kart için bilgiler gerekli');
      } else if (id) {
        unwrap(await supabase.from('ingredients').update(draft).eq('id', id).select('id').single());
      } else {
        ingredientId = unwrap(await supabase.from('ingredients').insert(draft).select('id').single()).id;
      }
      if (newPrice !== null && ingredientId) {
        unwrap(await supabase.from('ingredient_prices').insert({
          ingredient_id: ingredientId, price: newPrice, supplier_name: supplier?.trim() || null,
        }).select('id').single());
      }
      return ingredientId;
    },
    onSuccess: invalidate,
  });
}

/** RLS izin vermezse delete hata atmaz, 0 satır döner; bunu yetki hatasına çevir. */
async function deleteById(table: 'ingredients' | 'recipes' | 'menus', id: string) {
  const rows = unwrap(await supabase.from(table).delete().eq('id', id).select('id'));
  if (!rows || rows.length === 0) throw { code: '42501' };
}

export function useDeleteIngredient() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: (id: string) => deleteById('ingredients', id),
    onSuccess: invalidate,
  });
}

// ------------------------------------------------------------------ Reçeteler
export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    staleTime: Infinity,
    queryFn: async () => unwrap(await supabase.from('recipe_categories').select('*').order('sort')),
  });
}

export function useRecipeCosts() {
  return useQuery({
    queryKey: qk.recipeCosts,
    queryFn: async () => unwrap(await supabase.from('v_recipe_costs').select('*').order('name')),
  });
}

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: qk.recipe(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => unwrap(await supabase.from('recipes').select('*').eq('id', id!).single()),
  });
}

export function useRecipeLines(id: string | null) {
  return useQuery({
    queryKey: qk.recipeLines(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => unwrap(await supabase.from('v_recipe_lines').select('*').eq('recipe_id', id!).order('sort')),
  });
}

export interface RecipeHeaderDraft {
  code: string; name: string; category_code: string; portion_label: string;
  portion_served_g: number | null; instructions: string; active: boolean;
}
export interface RecipeLineDraft { ingredient_id: string; net_qty: number; waste_pct_override: number | null; note: string }

export function useSaveRecipe() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: async ({ id, header, lines }: { id: string | null; header: RecipeHeaderDraft; lines: RecipeLineDraft[] }) =>
      unwrap(await supabase.rpc('save_recipe', {
        p_id: id, p_header: header as never, p_lines: lines as never,
      })),
    onSuccess: invalidate,
  });
}

export function useDeleteRecipe() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: (id: string) => deleteById('recipes', id),
    onSuccess: invalidate,
  });
}

// ------------------------------------------------------------------ Menüler
export function useMenuCosts() {
  return useQuery({
    queryKey: qk.menuCosts,
    queryFn: async () => unwrap(await supabase.from('v_menu_costs').select('*').order('name')),
  });
}

export function useMenu(id: string | null) {
  return useQuery({
    queryKey: qk.menu(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const menu = unwrap(await supabase.from('menus').select('*').eq('id', id!).single());
      const items = unwrap(await supabase.from('menu_items').select('*').eq('menu_id', id!).order('sort'));
      return { menu, items };
    },
  });
}

export interface MenuHeaderDraft { code: string; name: string; kind: string; meal: string; target_price: number | null; notes: string; active: boolean }
export interface MenuItemDraft { recipe_id: string; portion_factor: number }

export function useSaveMenu() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: async ({ id, header, items }: { id: string | null; header: MenuHeaderDraft; items: MenuItemDraft[] }) =>
      unwrap(await supabase.rpc('save_menu', { p_id: id, p_header: header as never, p_items: items as never })),
    onSuccess: invalidate,
  });
}

export function useDeleteMenu() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: (id: string) => deleteById('menus', id),
    onSuccess: invalidate,
  });
}
