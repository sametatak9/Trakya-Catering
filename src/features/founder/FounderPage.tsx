import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { CheckCircle2, CircleDashed, Eye, EyeOff, PlugZap } from 'lucide-react';
import { GROUP_LABELS, MODULES, defaultVisible, permKey, type ModuleDef, type TabDef } from '@/app/modules';
import { useInsertRows, useRows } from '@/lib/crud';
import { ROLE_LABELS, type AppRole } from '@/lib/domain';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, ModuleHero, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';

const ROLES_EDITABLE: AppRole[] = ['yonetici', 'asci_basi', 'diyetisyen', 'depo', 'satinalma', 'muhasebe', 'pazarlamaci', 'sofor'];
const EDITABLE_MODULES = MODULES.filter((m) => m.path !== '/');
/** Matris satırları: sekmeli modülde her sekme ayrı satır (yetki anahtarı `/modul#sekme`) */
interface Row { m: ModuleDef; tab?: TabDef; key: string; label: string; hint: string }
const ROWS: Row[] = EDITABLE_MODULES.flatMap((m) => (m.tabs
  ? m.tabs.filter((t) => !(m.path === '/ayarlar' && t.id === 'yetkiler')).map((t) => ({ m, tab: t, key: permKey(m, t), label: `${m.label} › ${t.label}`, hint: m.hint }))
  : [{ m, key: m.path, label: m.label, hint: m.hint }]));

/** Kurucu: her üyeliğin görebileceği sekmeleri belirler. Veriye yazma yetkisi ayrıca veritabanında (RLS) rolle korunur. */
export function FounderPage() {
  const [tab, setTab] = useState<'roller' | 'kisiler' | 'entegrasyon'>('roller');
  return (
    <>
      <ModuleHero kicker="Sistem · Yalnız kurucu" title="Kurucu Paneli"
        description="Kurucu her şeyi görür. Buradan her rolün ve gerekirse tek bir kişinin hangi sekmeleri göreceğini belirlersiniz. Kayıtlara yazma yetkisi ayrıca veritabanında rol bazlı korunur." />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[
        { id: 'roller', label: 'Rol × sekme' }, { id: 'kisiler', label: 'Kişiye özel' }, { id: 'entegrasyon', label: 'Bağlantılar' },
      ]} /></div>
      {tab === 'roller' && <RoleMatrix />}
      {tab === 'kisiler' && <MemberOverrides />}
      {tab === 'entegrasyon' && <Integrations />}
    </>
  );
}

function RoleMatrix() {
  const toast = useToast();
  const perms = useRows('role_permissions', { key: ['all'] });
  const upsert = useInsertRows('role_permissions');
  const map = new Map((perms.data ?? []).map((r) => [`${r.role}|${r.module}`, r.level]));
  const visible = (r: Row, role: AppRole) => {
    const lv = map.get(`${role}|${r.key}`) ?? (r.tab ? map.get(`${role}|${r.m.path}`) : undefined);
    return lv ? lv !== 'yok' : defaultVisible(r.m, role, r.tab);
  };
  const toggle = async (r: Row, role: AppRole) => {
    try {
      await upsert.mutateAsync({ rows: [{ role, module: r.key, level: visible(r, role) ? 'yok' : 'gor' }], onConflict: 'role,module' });
    } catch (e) { toast.error(e); }
  };
  const groups = (Object.keys(GROUP_LABELS) as ModuleDef['group'][]).map((g) => ({ g, items: ROWS.filter((r) => r.m.group === g) })).filter((x) => x.items.length);

  return (
    <Panel pad={false} title="Hangi rol hangi sekmeyi görsün?" subtitle="Hücreye dokunun: göz açık = görür. Değişiklik o roldeki herkesin menüsüne hemen yansır.">
      <div className="overflow-x-auto tc-scroll">
        <table className="text-sm border-separate border-spacing-0 min-w-[900px] w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card text-left px-4 py-2.5 border-b border-line min-w-[220px]">Sekme</th>
              {ROLES_EDITABLE.map((r) => <th key={r} className="px-2 py-2.5 text-[11px] font-semibold text-ink-3 border-b border-line">{ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ g, items }) => (
              <Fragment key={g}>
                <tr><td colSpan={ROLES_EDITABLE.length + 1} className="sticky left-0 bg-surface-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">{GROUP_LABELS[g]}</td></tr>
                {items.map((m) => (
                  <tr key={m.key}>
                    <td className="sticky left-0 z-10 bg-card px-4 py-2 border-b border-line"><div className="font-semibold text-ink">{m.label}</div><div className="text-[11px] text-ink-3">{m.hint}</div></td>
                    {ROLES_EDITABLE.map((r) => {
                      const on = visible(m, r);
                      return (
                        <td key={r} className="px-2 py-2 border-b border-line text-center">
                          <button type="button" onClick={() => toggle(m, r)} aria-pressed={on} aria-label={`${ROLE_LABELS[r]} · ${m.label}`}
                            className={cx('w-9 h-9 rounded-xl grid place-items-center mx-auto transition', on ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-ink-3/60 hover:text-ink-3')}>
                            {on ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function MemberOverrides() {
  const toast = useToast();
  const team = useQuery({ queryKey: ['team'], queryFn: async () => unwrap(await supabase.rpc('list_team')) });
  const perms = useRows('member_permissions', { key: ['all'] });
  const upsert = useInsertRows('member_permissions');
  const [user, setUser] = useState('');
  const [mod, setMod] = useState('');
  const [level, setLevel] = useState<'gor' | 'yok'>('gor');
  const members = (team.data ?? []).filter((m) => m.role !== 'kurucu' && m.role !== 'musteri');
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.full_name || '—';

  const add = async () => {
    if (!user || !mod) return toast.error('Kişi ve sekme seçin');
    try { await upsert.mutateAsync({ rows: [{ user_id: user, module: mod, level }], onConflict: 'user_id,module' }); toast.ok('İstisna kaydedildi'); } catch (e) { toast.error(e); }
  };
  const remove = async (userId: string, module: string) => {
    try {
      const { error } = await supabase.from('member_permissions').delete().eq('user_id', userId).eq('module', module);
      if (error) throw error;
      await perms.refetch();
    } catch (e) { toast.error(e); }
  };

  return (
    <Panel title="Kişiye özel istisna" subtitle="Rol ayarından bağımsız olarak tek bir kişiye sekme açın ya da kapatın (ör. bir şoföre Stok ekranı)">
      <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
        <select className="tc-input" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Kişi">
          <option value="">Kişi seç…</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email} · {ROLE_LABELS[m.role as AppRole]}</option>)}
        </select>
        <select className="tc-input" value={mod} onChange={(e) => setMod(e.target.value)} aria-label="Sekme">
          <option value="">Sekme seç…</option>{ROWS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select className="tc-input" value={level} onChange={(e) => setLevel(e.target.value as 'gor' | 'yok')} aria-label="Durum">
          <option value="gor">Görsün</option><option value="yok">Görmesin</option>
        </select>
        <Button variant="holo" onClick={add} loading={upsert.isPending}>Kaydet</Button>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {(perms.data ?? []).length === 0 && <li className="py-3 text-sm text-ink-3">İstisna yok; herkes rolünün ayarını kullanıyor.</li>}
        {(perms.data ?? []).map((p) => (
          <li key={`${p.user_id}${p.module}`} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="font-semibold text-ink">{nameOf(p.user_id)}</span>
            <span className="text-ink-3">{ROWS.find((r) => r.key === p.module)?.label ?? MODULES.find((m) => m.path === p.module)?.label ?? p.module}</span>
            <Pill tone={p.level === 'yok' ? 'stop' : 'ok'}>{p.level === 'yok' ? 'görmez' : 'görür'}</Pill>
            <button type="button" className="ml-auto text-xs text-ink-3 hover:text-stop" onClick={() => remove(p.user_id, p.module)}>kaldır</button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const INTEGRATIONS: Array<{ name: string; ready: boolean; now: string; next: string }> = [
  { name: 'Parmak izi (ZKTeco)', ready: true, now: 'Cihazın dışa aktardığı CSV dosyası Puantaj ekranından yüklenir; ilk giriş / son çıkış otomatik eşleşir.', next: 'Doğrudan cihaz bağlantısı için işyerinde küçük bir aktarım programı kurulur.' },
  { name: 'Müşteri sipariş linki', ready: true, now: 'Her firmanın gizli linki Müşteriler & Cari ekranında. Firma giriş yapmadan sayı girer; 16:00 kesimi uygulanır.', next: '—' },
  { name: 'Gelen e-Fatura', ready: true, now: 'GİB/entegratör XML dosyaları toplu yüklenir; gider kalemi ve hammadde fiyatı otomatik tespit edilir.', next: 'Entegratör API bilgisi girilince faturalar kendiliğinden düşer.' },
  { name: 'Satış e-Fatura / e-Arşiv', ready: false, now: 'İrsaliyelerden aylık satış faturası oluşur ve UBL-TR XML olarak indirilir (entegratör portalına yüklenebilir).', next: 'Entegratör (ör. QNB eFinans, Uyumsoft, Logo) API anahtarı sunucu tarafında tanımlanınca tek tuşla gönderim.' },
  { name: 'Navigasyon', ready: true, now: 'Rota ve şoför ekranında her durak için Google Haritalar / Yandex Navigasyon yol tarifi açılır.', next: '—' },
  { name: 'Araç takip (Arvento / Mobiliz)', ready: false, now: 'Km, yakıt fişi ve bakım Araçlar ekranından girilir; kasaya gider olarak düşer.', next: 'Takip firmasının API anahtarı girilince km ve yakıt tüketimi otomatik çekilir.' },
  { name: 'WhatsApp', ready: true, now: 'Tüm raporlar ve kartvizitler telefonun WhatsApp’ı ile gönderilir.', next: 'WhatsApp Business API ile otomatik bildirim.' },
  { name: 'Sosyal medya', ready: false, now: 'İçerik havuzu, aylık takvim ve onay akışı hazır; metin kopyalanıp paylaşılır.', next: 'Meta (Instagram/Facebook) ve Google İşletme hesabı bağlanınca planlı gönderiler kendiliğinden yayınlanır.' },
];

function Integrations() {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {INTEGRATIONS.map((i) => (
        <div key={i.name} className="tc-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-ink"><PlugZap className="w-4 h-4 text-brand" />{i.name}</div>
            {i.ready ? <Pill tone="ok"><CheckCircle2 className="w-3 h-3" /> çalışıyor</Pill> : <Pill tone="wait"><CircleDashed className="w-3 h-3" /> bağlantı bekliyor</Pill>}
          </div>
          <p className="text-sm text-ink-2 mt-2">{i.now}</p>
          {i.next !== '—' && <p className="text-xs text-ink-3 mt-1.5">Sonraki adım: {i.next}</p>}
        </div>
      ))}
    </div>
  );
}
