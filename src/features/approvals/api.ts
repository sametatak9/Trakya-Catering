import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRows, type Row } from '@/lib/crud';
import { supabase, unwrap } from '@/lib/supabase';

export type ApprovalRequest = Row<'approval_requests'>;

export const APPROVAL_STATUS: Record<string, { label: string; tone: 'wait' | 'ok' | 'stop' | 'idle' }> = {
  bekliyor: { label: 'Bekliyor', tone: 'wait' },
  onaylandi: { label: 'Onaylandı', tone: 'ok' },
  reddedildi: { label: 'Reddedildi', tone: 'stop' },
  iptal: { label: 'İptal', tone: 'idle' },
};

/** Görebildiğim onay talepleri (RLS: kendi taleplerim + karar yetkim olanlar) */
export function useApprovals(status?: string) {
  return useRows('approval_requests', {
    key: [status ?? 'hepsi'], order: 'requested_at', ascending: status === 'bekliyor',
    filter: status ? (q) => q.eq('status', status) : (q) => q.limit(60),
  });
}

export function useDecide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; decision: 'onaylandi' | 'reddedildi' | 'iptal'; note?: string; extra?: Record<string, unknown> }) =>
      unwrap(await supabase.rpc('decide_approval', { p_id: a.id, p_decision: a.decision, p_note: a.note ?? undefined, p_extra: (a.extra ?? {}) as never })),
    onSuccess: () => Promise.all([
      ...['approval_requests', 'employee_requests', 'employee_ledger', 'finance_entries'].map((t) => qc.invalidateQueries({ queryKey: ['t', t] })),
      qc.invalidateQueries({ queryKey: ['finance'] }),
    ]),
  });
}
