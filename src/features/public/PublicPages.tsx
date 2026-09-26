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

interface PortalOrder { date: string; meal: string; qty: number; status: string; open: boolean }
interface PortalInfo { customer: string; today: string; orders: PortalOrder[]; meals: string[] }

/** Müşteri sipariş linki: firma giriş yapmadan önümüzdeki günlerin kişi sayısını girer (önceki gün 16:00'ya kadar). */
export function OrderPortalPage({ token }: { token: string }) {
  const [info, setInfo] = useState<PortalInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('portal_info', { p_token: token }).then(({ data, error: err }) => {
      if (err) setError(describeError(err)); else setInfo(data as unknown as PortalInfo);
    });
  }, [token]);

  if (error) return <Frame><div className="tc-card p-8 text-center"><div className="text-lg font-bold text-ink">Link geçersiz</div><p className="text-sm text-ink-3 mt-1">Firmanıza verilen sipariş linkini kontrol edin.</p></div></Frame>;
  if (!info) return <Frame><Loading /></Frame>;

  const nowH = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const firstOpen = addDays(info.today, nowH < 16 ? 1 : 2);
  const days = Array.from({ length: 6 }, (_, i) => addDays(firstOpen, i));
  const meals = info.meals.length ? info.meals : ['ogle'];
  const current = (d: string, m: string) => info.orders.find((o) => o.date === d && o.meal === m);
  const key = (d: string, m: string) => `${d}|${m}`;
  const value = (d: string, m: string) => draft[key(d, m)] ?? current(d, m)?.qty ?? 0;

  const submit = async (d: string, m: string) => {
    setSaving(key(d, m)); setError(null);
    const { data, error: err } = await supabase.rpc('portal_set_order', { p_token: token, p_date: d, p_meal: m, p_qty: value(d, m) });
    setSaving(null);
    if (err) { setError(describeError(err)); return; }
    setInfo(data as unknown as PortalInfo); setSaved(key(d, m));
    setDraft((x) => { const n = { ...x }; delete n[key(d, m)]; return n; });
  };

  return (
    <Frame>
      <div className="flex items-center gap-3 mb-5"><Logo size={44} /><div><div className="font-display font-extrabold text-lg tracking-tight text-ink">TRAKYA CATERING</div><div className="text-xs text-ink-3">Yemek sipariş formu</div></div></div>
      <div className="tc-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-brand">Firma</div>
        <h1 className="text-xl font-bold text-ink">{info.customer}</h1>
        <p className="text-sm text-ink-3 mt-1">Kişi sayısını girip <b>Kaydet</b>’e basın. Ertesi günün sayısı <b>saat 16:00</b>’ya kadar değiştirilebilir.</p>
      </div>
      <div className="space-y-3 mt-4">
        {days.map((d) => (
          <div key={d} className="tc-card p-4">
            <div className="font-bold text-ink mb-2">{new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            {meals.map((m) => {
              const k = key(d, m); const cur = current(d, m); const dirty = draft[k] !== undefined && draft[k] !== (cur?.qty ?? 0);
              return (
                <div key={m} className="flex items-center gap-2 py-1.5">
                  <span className="w-20 text-sm text-ink-2">{MEALS[m]}</span>
                  <button type="button" className="w-10 h-10 rounded-xl ring-1 ring-line grid place-items-center" onClick={() => setDraft((x) => ({ ...x, [k]: Math.max(0, value(d, m) - 5) }))} aria-label="Azalt"><Minus className="w-4 h-4" /></button>
                  <input className="tc-input tc-num text-center !text-lg !w-24" inputMode="numeric" value={value(d, m)}
                    onChange={(e) => setDraft((x) => ({ ...x, [k]: Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, '')) || 0)) }))} aria-label={`${d} ${MEALS[m]} kişi`} />
                  <button type="button" className="w-10 h-10 rounded-xl ring-1 ring-line grid place-items-center" onClick={() => setDraft((x) => ({ ...x, [k]: value(d, m) + 5 }))} aria-label="Artır"><Plus className="w-4 h-4" /></button>
                  <div className="ml-auto">
                    {dirty ? <Button size="sm" variant="holo" icon={<Save className="w-3.5 h-3.5" />} loading={saving === k} onClick={() => submit(d, m)}>Kaydet</Button>
                      : cur ? <span className={cx('inline-flex items-center gap-1 text-xs font-semibold', saved === k ? 'text-ok' : 'text-ink-3')}><Check className="w-3.5 h-3.5" />{fmtNum(cur.qty, 0)} kişi</span>
                        : <span className="text-xs text-ink-3">girilmedi</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {error && <div className="mt-3 rounded-xl bg-stop-soft text-stop px-3 py-2 text-sm">{error}</div>}
    </Frame>
  );
}
