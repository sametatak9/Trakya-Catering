import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useMember } from '@/app/session';
import { ROLE_LABELS, type AppRole } from '@/lib/domain';
import { fmtDate } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Panel, Pill } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { CompanyPanel } from '../settings/CompanyPanel';

// Müşteri portal rolü, cari (customers) modülü ile Faz 3'te atanabilir olacak.
const ASSIGNABLE: AppRole[] = ['yonetici', 'asci_basi', 'diyetisyen', 'muhasebe', 'satinalma', 'pazarlamaci', 'depo', 'sofor'];

export function TeamPage() {
  const me = useMember();
  const qc = useQueryClient();
  const toast = useToast();
  const team = useQuery({ queryKey: ['team'], queryFn: async () => unwrap(await supabase.rpc('list_team')) });
  const pending = useQuery({ queryKey: ['team_pending'], queryFn: async () => unwrap(await supabase.rpc('list_pending_users')) });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['team'] }), qc.invalidateQueries({ queryKey: ['team_pending'] })]);

  const assign = useMutation({
    mutationFn: async ({ userId, fullName, role }: { userId: string; fullName: string; role: AppRole }) =>
      unwrap(await supabase.from('team_members').insert({ user_id: userId, full_name: fullName, role }).select('user_id').single()),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ userId, patch }: { userId: string; patch: { role?: AppRole; active?: boolean } }) =>
      unwrap(await supabase.from('team_members').update(patch).eq('user_id', userId).select('user_id').single()),
    onSuccess: refresh,
  });

  const [roleFor, setRoleFor] = useState<Record<string, AppRole>>({});

  return (
    <>
      <ModuleHero kicker="Sistem" title="Ekip & Yetkiler"
        description="Kayıt olan kullanıcılar rol atanana kadar hiçbir veriye erişemez. Yetkiler veritabanında (RLS) uygulanır; arayüz yalnızca yansıtır."
        stats={[
          { label: 'Aktif üye', value: (team.data ?? []).filter((m) => m.active).length },
          { label: 'Rol bekleyen', value: (pending.data ?? []).length, tone: (pending.data ?? []).length ? 'warn' : 'default' },
        ]} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Rol bekleyen kullanıcılar" subtitle="Kayıt olup erişim bekleyenler">
          {pending.isLoading ? <Loading /> : pending.error ? <ErrorNote>Liste alınamadı.</ErrorNote>
            : (pending.data ?? []).length === 0 ? (
              <EmptyState icon={<UserPlus className="w-5 h-5" />} title="Bekleyen yok">
                Yeni çalışanlar giriş ekranından kayıt olur, burada rol atarsınız.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {(pending.data ?? []).map((u) => (
                  <li key={u.user_id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">{u.full_name || u.email}</div>
                      <div className="text-[11px] text-ink-3">{u.email} · {fmtDate(u.created_at)}</div>
                    </div>
                    <select className="tc-input sm:!w-40" value={roleFor[u.user_id] ?? 'asci_basi'}
                      onChange={(e) => setRoleFor({ ...roleFor, [u.user_id]: e.target.value as AppRole })}>
                      {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <Button variant="primary" size="sm" loading={assign.isPending && assign.variables?.userId === u.user_id}
                      onClick={() => assign.mutate(
                        { userId: u.user_id, fullName: u.full_name || u.email.split('@')[0], role: roleFor[u.user_id] ?? 'asci_basi' },
                        { onSuccess: () => toast.ok('Rol atandı'), onError: toast.error },
                      )}>Rol ata</Button>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="Ekip" subtitle="Rol değiştir veya erişimi durdur">
          {team.isLoading ? <Loading /> : team.error ? <ErrorNote>Ekip listesi alınamadı.</ErrorNote> : (
            <ul className="divide-y divide-line">
              {(team.data ?? []).map((m) => (
                <li key={m.user_id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink truncate flex items-center gap-2">
                      {m.full_name || m.email}
                      {m.user_id === me.userId && <Pill tone="brand">Siz</Pill>}
                      {!m.active && <Pill tone="stop">Pasif</Pill>}
                    </div>
                    <div className="text-[11px] text-ink-3">{m.email}</div>
                  </div>
                  {m.role === 'musteri' ? <Pill tone="info">{ROLE_LABELS.musteri}</Pill> : (
                    <select className="tc-input sm:!w-40" value={m.role} disabled={update.isPending}
                      onChange={(e) => update.mutate({ userId: m.user_id, patch: { role: e.target.value as AppRole } },
                        { onSuccess: () => toast.ok('Rol güncellendi'), onError: toast.error })}>
                      {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  )}
                  <Button size="sm" variant={m.active ? 'danger' : 'ghost'} disabled={update.isPending}
                    onClick={() => update.mutate({ userId: m.user_id, patch: { active: !m.active } },
                      { onSuccess: () => toast.ok(m.active ? 'Erişim durduruldu' : 'Erişim açıldı'), onError: toast.error })}>
                    {m.active ? 'Durdur' : 'Aç'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 text-[11px] text-ink-3 mt-3"><ShieldCheck className="w-3.5 h-3.5" /> Son aktif yönetici kaldırılamaz.</div>
        </Panel>
      </div>
      <div className="mt-4"><CompanyPanel /></div>
    </>
  );
}
