import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/lib/database.types';

export type CompanySettings = Tables<'company_settings'>;

export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    staleTime: 10 * 60_000,
    queryFn: async () => unwrap(await supabase.from('company_settings').select('*').eq('id', 1).single()),
  });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TablesUpdate<'company_settings'>) =>
      unwrap(await supabase.from('company_settings').update(patch).eq('id', 1).select('id').single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company'] }),
  });
}
