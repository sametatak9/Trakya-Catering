import { useEffect, useState } from 'react';
import { Check, Globe, Mail, MapPin, Minus, Phone, Plus, Save } from 'lucide-react';
import { addDays } from '@/lib/dates';
import { MEALS } from '@/lib/domain';
import { fmtNum } from '@/lib/format';
import { describeError, supabase } from '@/lib/supabase';
import { HoloSeal, Logo } from '@/ui/Logo';
import { Button, Loading, cx } from '@/ui/primitives';
import { DEPARTMENTS } from '../people/api';

// Giriş gerektirmeyen iki sayfa: personel kartviziti (/kart/:slug) ve müşteri sipariş linki (/siparis/:token).
// İkisi de yalnız security definer fonksiyonla okur; tablolara doğrudan erişemez.

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">{children}</div>
      <div className="text-center text-[11px] text-ink-3 mt-8">Trakya Catering · Toplu yemek üretimi</div>
    </div>
  );
}

interface Card { full_name: string; title: string | null; department: string; phone: string | null; email: string | null; company: string; company_phone: string | null; website: string | null; address: string | null }

export function CardPage({ slug }: { slug: string }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  useEffect(() => {
    supabase.rpc('public_card', { p_slug: slug }).then(({ data }) => setCard((data as Card[] | null)?.[0] ?? null));
  }, [slug]);
  if (card === undefined) return <Frame><Loading /></Frame>;
  if (card === null) return <Frame><div className="tc-card p-8 text-center text-ink-2">Kartvizit bulunamadı.</div></Frame>;
  const vcf = [
    'BEGIN:VCARD', 'VERSION:3.0', `FN:${card.full_name}`, `ORG:${card.company}`, card.title ? `TITLE:${card.title}` : '',
    card.phone ? `TEL;TYPE=CELL:${card.phone}` : '', card.email ? `EMAIL:${card.email}` : '', card.website ? `URL:${card.website}` : '', 'END:VCARD',
  ].filter(Boolean).join('\n');
  return (
    <Frame>
      <div className="tc-card tc-holo-in overflow-hidden">
        <div className="relative bg-brand text-on-brand px-6 pt-6 pb-16">
          <div className="flex items-center gap-2.5"><Logo size={40} /><div className="font-display font-extrabold tracking-tight">TRAKYA CATERING</div></div>
          <div className="absolute -bottom-10 right-6"><HoloSeal size={80} label="KARTVİZİT" /></div>
        </div>
        <div className="px-6 pt-5 pb-6">
          <h1 className="text-2xl font-bold text-ink">{card.full_name}</h1>
          <div className="text-sm text-ink-3 mt-0.5">{card.title ?? DEPARTMENTS[card.department]} · {card.company}</div>
          <div className="tc-harvest-rule w-14 my-4" />
          <ul className="space-y-2.5 text-[15px]">
            {card.phone && <li><a href={`tel:${card.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 text-ink hover:text-brand"><Phone className="w-4 h-4 text-brand" />{card.phone}</a></li>}
            {card.email && <li><a href={`mailto:${card.email}`} className="flex items-center gap-3 text-ink hover:text-brand"><Mail className="w-4 h-4 text-brand" />{card.email}</a></li>}
            {card.company_phone && <li className="flex items-center gap-3 text-ink-2"><Phone className="w-4 h-4 text-ink-3" />{card.company_phone} (firma)</li>}
            {card.website && <li><a href={card.website.startsWith('http') ? card.website : `https://${card.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-ink hover:text-brand"><Globe className="w-4 h-4 text-brand" />{card.website}</a></li>}
            {card.address && <li className="flex items-start gap-3 text-ink-2"><MapPin className="w-4 h-4 text-brand mt-0.5" />{card.address}</li>}
          </ul>
          <a href={`data:text/vcard;charset=utf-8,${encodeURIComponent(vcf)}`} download={`${card.full_name}.vcf`}
            className="mt-6 flex items-center justify-center gap-2 rounded-2xl tc-holo py-3 font-bold">Rehbere kaydet</a>
        </div>
      </div>
    </Frame>
  );
}

interface PortalOrder { date: string; meal: string; qty: number; status: string; open: boolean; customer_menu_id: string | null }
interface PortalMenu { id: string; meal: string; name: string; type: string | null; style: string | null; is_default: boolean }
interface PortalDay { date: string; meal: string; own: boolean; dishes: Array<{ name: string; course: string; recipe_id: string }> }
interface PortalFeedback { date: string; meal: string; kind: string; rating: number | null; text: string | null; status: string; at: string }
interface PortalInfo { customer: string; today: string; month: string; menus: PortalMenu[]; orders: PortalOrder[]; meals: string[]; month_menu: PortalDay[]; feedback: PortalFeedback[]; balance_available: boolean }

type PortalTab = 'siparis' | 'menu' | 'geri' | 'bakiye';
const TAB_LABELS: Record<PortalTab, string> = { siparis: 'Sipariş', menu: 'Aylık menü', geri: 'Geri bildirim', bakiye: 'Bakiye' };
const FB_KIND: Record<string, string> = { begeni: 'Beğeni', sikayet: 'Şikâyet', oneri: 'Öneri', revizyon: 'Değişiklik isteği' };
const FB_STATUS: Record<string, string> = { yeni: 'İletildi', incelendi: 'İnceleniyor', cozuldu: 'Çözüldü' };
const CATS: Record<string, string> = { lezzet: 'Lezzet', gramaj: 'Porsiyon / gramaj', sicaklik: 'Sıcaklık', hijyen: 'Hijyen', gec_teslim: 'Geç teslim', eksik: 'Eksik ürün', yabanci_madde: 'Yabancı madde', servis: 'Servis', diger: 'Diğer' };
const monthShift = (m: string, n: number) => { const [y, mo] = m.slice(0, 7).split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 10); };

/**
 * Müşteri portalı v2 (Faz 3D, EK-1 / Not 7): firma giriş yapmadan (sipariş linki) veya müşteri hesabıyla
 * kişi sayısı girer (önceki gün 16:00'ya kadar), aylık menüyü görür, geri bildirim ve puan bırakır. Bakiye Faz 4'te (PIN ile).
 */
export function OrderPortalPage({ token }: { token: string }) {
  const [info, setInfo] = useState<PortalInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [tab, setTab] = useState<PortalTab>('siparis');
  const [month, setMonth] = useState<string | null>(null);

  const load = (m: string | null) => supabase.rpc('portal_info_v2', { p_token: token, p_month: m as string }).then(({ data, error: err }) => {
    const d = data as unknown as PortalInfo | null;
    if (err || !d?.customer) { if (!info) setInvalid(true); else setError(err ? describeError(err) : 'Yüklenemedi'); } else setInfo(d);
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(month); }, [token, month]);

  if (invalid) return <Frame><div className="tc-card p-8 text-center"><div className="text-lg font-bold text-ink">Link geçersiz</div><p className="text-sm text-ink-3 mt-1">Firmanıza verilen sipariş linkini kontrol edin. Link yenilendiyse eski link çalışmaz.</p></div></Frame>;
  if (!info) return <Frame><Loading /></Frame>;

  return (
    <Frame>
      <div className="flex items-center gap-3 mb-5"><Logo size={44} /><div><div className="font-display font-extrabold text-lg tracking-tight text-ink">TRAKYA CATERING</div><div className="text-xs text-ink-3">Firma portalı · <a className="underline hover:text-brand" href={`${import.meta.env.BASE_URL}iletisim.html`} target="_blank" rel="noopener">iletişim</a></div></div></div>
      <div className="tc-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-brand">Firma</div>
        <h1 className="text-xl font-bold text-ink">{info.customer}</h1>
      </div>
      <div role="tablist" aria-label="Portal" className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 text-sm font-semibold">
        {(Object.keys(TAB_LABELS) as PortalTab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cx('flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 transition', tab === t ? 'bg-card text-ink shadow-sm' : 'text-ink-3')}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <div className="mt-3">
        {tab === 'siparis' && <PortalOrders token={token} info={info} onInfo={setInfo} onError={setError} />}
        {tab === 'menu' && <PortalMonth info={info} onMonth={(n) => setMonth(monthShift(info.month, n))} />}
        {tab === 'geri' && <PortalFeedbackTab token={token} info={info} onDone={() => load(month)} onError={setError} />}
        {tab === 'bakiye' && (
          <div className="tc-card p-6 text-center">
            <div className="font-bold text-ink">Bakiye Faz 4'te açılacak</div>
            <p className="mt-1 text-sm text-ink-3">Faturalanmamış teslimatlar, açık bakiye ve vadesi gelenler burada görünecek. Güvenlik için bakiye yalnız firmanıza verilen PIN ile veya müşteri hesabıyla açılır.</p>
          </div>
        )}
      </div>
      {error && <div className="mt-3 rounded-xl bg-stop-soft text-stop px-3 py-2 text-sm" role="alert">{error}</div>}
    </Frame>
  );
}

function PortalOrders({ token, info, onInfo, onError }: { token: string; info: PortalInfo; onInfo: (i: PortalInfo) => void; onError: (e: string | null) => void }) {
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const nowH = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const firstOpen = addDays(info.today, nowH < 16 ? 1 : 2);
  const days = Array.from({ length: 6 }, (_, i) => addDays(firstOpen, i));
  // Satırlar: menü tanımı varsa öğün × menü; yoksa öğün
  const slots: Array<{ meal: string; cm: PortalMenu | null }> = [];
  const meals = info.meals.length ? info.meals : ['ogle'];
  for (const m of ['kahvalti', 'ogle', 'aksam', 'gece']) {
    const defs = info.menus.filter((x) => x.meal === m);
    if (defs.length) defs.forEach((cm) => slots.push({ meal: m, cm }));
    else if (meals.includes(m)) slots.push({ meal: m, cm: null });
  }
  const current = (d: string, m: string, cm: string | null) => info.orders.find((o) => o.date === d && o.meal === m && (o.customer_menu_id ?? null) === cm);
  const key = (d: string, m: string, cm: string | null) => `${d}|${m}|${cm ?? ''}`;
  const value = (d: string, m: string, cm: string | null) => draft[key(d, m, cm)] ?? current(d, m, cm)?.qty ?? 0;
  const submit = async (d: string, m: string, cm: string | null) => {
    const k = key(d, m, cm);
    setSaving(k); onError(null);
    const { data, error: err } = await supabase.rpc('portal_set_order_v2', { p_token: token, p_date: d, p_meal: m, p_qty: value(d, m, cm), p_customer_menu_id: cm as string });
    setSaving(null);
    if (err) { onError(describeError(err)); return; }
    onInfo(data as unknown as PortalInfo); setSaved(k);
    setDraft((x) => { const n = { ...x }; delete n[k]; return n; });
  };
  return (
    <>
      <p className="text-sm text-ink-3 mb-3">Kişi sayısını girip <b>Kaydet</b>’e basın. Ertesi günün sayısı <b>saat 16:00</b>’ya kadar değiştirilebilir.</p>
      <div className="space-y-3">
        {days.map((d) => (
          <div key={d} className="tc-card p-4">
            <div className="font-bold text-ink mb-2">{new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            {slots.map(({ meal: m, cm }) => {
              const cmId = cm?.id ?? null;
              const k = key(d, m, cmId); const cur = current(d, m, cmId); const dirty = draft[k] !== undefined && draft[k] !== (cur?.qty ?? 0);
              return (
                <div key={`${m}-${cmId ?? ''}`} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="w-24 text-sm text-ink-2 leading-tight">{MEALS[m]}{cm && <span className="block text-[11px] text-ink-3">{cm.name}{cm.style ? ` · ${cm.style}` : ''}</span>}</span>
                  <button type="button" className="w-10 h-10 rounded-xl ring-1 ring-line grid place-items-center" onClick={() => setDraft((x) => ({ ...x, [k]: Math.max(0, value(d, m, cmId) - 5) }))} aria-label="Azalt"><Minus className="w-4 h-4" /></button>
                  <input className="tc-input tc-num text-center !text-lg !w-20" inputMode="numeric" value={value(d, m, cmId)}
                    onChange={(e) => setDraft((x) => ({ ...x, [k]: Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, '')) || 0)) }))} aria-label={`${d} ${MEALS[m]}${cm ? ` ${cm.name}` : ''} kişi`} />
                  <button type="button" className="w-10 h-10 rounded-xl ring-1 ring-line grid place-items-center" onClick={() => setDraft((x) => ({ ...x, [k]: value(d, m, cmId) + 5 }))} aria-label="Artır"><Plus className="w-4 h-4" /></button>
                  <div className="ml-auto">
                    {dirty ? <Button size="sm" variant="holo" icon={<Save className="w-3.5 h-3.5" />} loading={saving === k} onClick={() => submit(d, m, cmId)}>Kaydet</Button>
                      : cur ? <span className={cx('inline-flex items-center gap-1 text-xs font-semibold', saved === k ? 'text-ok' : 'text-ink-3')}><Check className="w-3.5 h-3.5" />{fmtNum(cur.qty, 0)} kişi</span>
                        : <span className="text-xs text-ink-3">girilmedi</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

/** Aylık menü (salt okunur ajanda): firmaya özel plan varsa o, yoksa genel menü */
function PortalMonth({ info, onMonth }: { info: PortalInfo; onMonth: (n: number) => void }) {
  const byDay = new Map<string, PortalDay[]>();
  for (const x of info.month_menu) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x]);
  const days = [...byDay.keys()].sort();
  const label = new Date(info.month.slice(0, 7) + '-15T12:00:00Z').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-card p-1">
        <button type="button" className="h-8 w-8 rounded-lg hover:bg-surface-2" aria-label="Önceki ay" onClick={() => onMonth(-1)}>‹</button>
        <span className="font-display font-bold capitalize">{label}</span>
        <button type="button" className="h-8 w-8 rounded-lg hover:bg-surface-2" aria-label="Sonraki ay" onClick={() => onMonth(1)}>›</button>
      </div>
      {days.length === 0 ? <div className="tc-card p-6 text-center text-sm text-ink-3">Bu ay için yayınlanmış menü yok.</div> : (
        <div className="space-y-2">
          {days.map((d) => (
            <div key={d} className={cx('tc-card p-3', d === info.today && 'ring-2 ring-accent')}>
              <div className="text-sm font-bold text-ink">{new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              {(byDay.get(d) ?? []).sort((a, b) => ['kahvalti', 'ogle', 'aksam', 'gece'].indexOf(a.meal) - ['kahvalti', 'ogle', 'aksam', 'gece'].indexOf(b.meal)).map((x) => (
                <div key={x.meal} className="mt-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-brand">{MEALS[x.meal]}{x.own ? ' · size özel' : ''}</div>
                  <div className="text-sm text-ink-2">{x.dishes.map((dd) => dd.name).join(' · ') || '—'}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortalFeedbackTab({ token, info, onDone, onError }: { token: string; info: PortalInfo; onDone: () => void; onError: (e: string | null) => void }) {
  const [f, setF] = useState({ date: addDays(info.today, -1), meal: info.meals[0] ?? 'ogle', kind: 'begeni', rating: 0, category: 'lezzet', text: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const send = async (override?: Partial<typeof f>) => {
    const v = { ...f, ...override };
    setBusy(true); onError(null);
    const { error: err } = await supabase.rpc('portal_feedback', { p_token: token, p_date: v.date, p_meal: v.meal, p_kind: v.kind, p_rating: (v.rating || null) as number,
      p_text: (v.text.trim() || null) as string, p_category: (v.kind === 'sikayet' ? v.category : null) as string, p_recipe_id: null as unknown as string });
    setBusy(false);
    if (err) { onError(describeError(err)); return; }
    setDone(true); setF({ ...f, text: '', rating: 0 }); onDone();
  };
  return (
    <div className="space-y-3">
      <div className="tc-card p-4">
        <div className="font-bold text-ink">Dünkü yemek nasıldı?</div>
        <div className="mt-2 flex gap-2">
          <Button onClick={() => send({ kind: 'begeni', rating: 5 })} loading={busy}>👍 Beğendik</Button>
          <Button onClick={() => { setF({ ...f, kind: 'sikayet', rating: 2 }); }}>👎 Beğenmedik</Button>
        </div>
        {done && <p className="mt-2 text-sm text-ok">Teşekkürler, iletildi.</p>}
      </div>
      <div className="tc-card p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-ink-3">Tarih<input type="date" className="tc-input mt-1" value={f.date} max={info.today} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="text-xs font-semibold text-ink-3">Öğün<select className="tc-input mt-1" value={f.meal} onChange={(e) => setF({ ...f, meal: e.target.value })}>{Object.entries(MEALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs font-semibold text-ink-3">Tür<select className="tc-input mt-1" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(FB_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {f.kind === 'sikayet' && <label className="text-xs font-semibold text-ink-3">Konu<select className="tc-input mt-1" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Puan">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={f.rating === n} aria-label={`${n} yıldız`} onClick={() => setF({ ...f, rating: n })}
              className={cx('text-2xl leading-none', n <= f.rating ? 'text-accent' : 'text-line-strong')}>★</button>
          ))}
          <span className="ml-2 text-xs text-ink-3">isteğe bağlı</span>
        </div>
        <textarea className="tc-input" rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder={f.kind === 'begeni' ? 'Not (isteğe bağlı)' : 'Kısaca yazın (ör. pilav soğuktu)'} aria-label="Açıklama" />
        <div className="flex justify-end"><Button variant="primary" onClick={() => send()} loading={busy}>Gönder</Button></div>
      </div>
      {info.feedback.length > 0 && (
        <div className="tc-card p-4">
          <div className="text-sm font-bold text-ink mb-2">Son gönderdikleriniz</div>
          <ul className="divide-y divide-line text-sm">
            {info.feedback.map((x, i) => (
              <li key={i} className="py-2">
                <div className="flex items-center gap-2 text-xs text-ink-3"><b className="text-ink-2">{FB_KIND[x.kind] ?? x.kind}</b>{x.rating ? <span className="text-accent">{'★'.repeat(x.rating)}</span> : null}<span>{x.date} · {MEALS[x.meal]}</span><span className="ml-auto">{FB_STATUS[x.status] ?? x.status}</span></div>
                {x.text && <div className="text-ink-2">{x.text}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
