import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Bell, BellRing, CheckCheck, ChefHat, CircleDollarSign, ClipboardList, FileInput, Sparkles, Tag, TrendingUp, X,
} from 'lucide-react';
import { useRouter } from '@/app/router';
import { useCan, useMember } from '@/app/session';
import { addDays, minutesToCutoff, todayISO } from '@/lib/dates';
import { PRICE_STALE_DAYS, ROLES } from '@/lib/domain';
import { assistantSummary, buildAlerts, type Alert, type AlertKind, type AlertTone } from '@/lib/alerts';
import { supabase, unwrap } from '@/lib/supabase';
import { cx } from '@/ui/primitives';
import { useOpenItems, useInvoices } from '../finance/api';
import { useIngredients, useMenuCosts } from '../kitchen/api';
import { usePrepBatches } from '../production/api';
import { orderPeople, useCustomers, useOrders } from '../sales/api';

const READ_KEY = 'tc_read_alerts';
function readSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
function writeSet(s: Set<string>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-400))); } catch { /* yok say */ }
}

const KIND_ICON: Record<AlertKind, typeof Bell> = {
  fiyat: TrendingUp, alacak: CircleDollarSign, borc: CircleDollarSign, siparis: ClipboardList, mutfak: ChefHat, maliyet: Tag, fatura: FileInput,
};
const TONE_CLS: Record<AlertTone, string> = {
  stop: 'bg-stop-soft text-stop', wait: 'bg-wait-soft text-wait', info: 'bg-info-soft text-info', ok: 'bg-ok-soft text-ok',
};

/** Tüm uyarıları kullanıcının rolüne göre hesaplar */
export function useAlerts() {
  const member = useMember();
  const isFinance = useCan(ROLES.finance);
  const seesInvoices = useCan(ROLES.invoices);
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const ingredients = useIngredients();
  const prices = useQuery({
    queryKey: ['ingredient_prices', 'recent'],
    queryFn: async () => unwrap(await supabase.from('ingredient_prices').select('ingredient_id, price, noted_at').gte('noted_at', addDays(today, -120))),
  });
  const menus = useMenuCosts();
  const open = useOpenItems(isFinance);
  const customers = useCustomers();
  const orders = useOrders(today, tomorrow);
  const batches = usePrepBatches(today, today);
  const invoices = useInvoices(addDays(today, -60), today);

  return useMemo(() => {
    const todayOrders = (orders.data ?? []).filter((o) => o.service_date === today && o.status !== 'iptal');
    const people = todayOrders.filter((o) => o.meal === 'ogle').reduce((s, o) => s + orderPeople(o), 0);
    const lunchCost = (batches.data ?? []).filter((b) => b.meal === 'ogle').reduce((s, b) => s + Number(b.total_cost ?? 0), 0);
    const alerts = buildAlerts({
      today, minutesToCutoff: minutesToCutoff(), staleDays: PRICE_STALE_DAYS,
      ingredients: ingredients.data ?? [],
      prices: (prices.data ?? []).map((p) => ({ ...p, price: Number(p.price) })),
      menus: (menus.data ?? []).map((m) => ({ ...m, name: m.name, active: m.active })),
      openItems: isFinance ? (open.data ?? []) : [],
      customers: customers.data ?? [],
      tomorrowOrders: (orders.data ?? []).filter((o) => o.service_date === tomorrow && o.meal === 'ogle'),
      upcomingOrders: orders.data ?? [],
      todayBatches: batches.data ?? [],
      draftInvoices: seesInvoices ? (invoices.data ?? []).filter((i) => i.status === 'taslak').length : 0,
    }).filter((a) => isFinance || !['alacak', 'borc', 'maliyet'].includes(a.kind));
    const first = member.fullName.split(' ')[0];
    const summary = assistantSummary(alerts, { people, perPerson: people > 0 && lunchCost > 0 ? lunchCost / people : null, name: first });
    return { alerts, summary };
  }, [ingredients.data, prices.data, menus.data, open.data, customers.data, orders.data, batches.data, invoices.data, isFinance, seesInvoices, today, tomorrow, member.fullName]);
}

export function NotificationBell() {
  const { go } = useRouter();
  const { alerts, summary } = useAlerts();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(readSet);
  const [tab, setTab] = useState<'hepsi' | 'yeni'>('yeni');
  const box = useRef<HTMLDivElement>(null);
  const unread = alerts.filter((a) => !read.has(a.id));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, [open]);

  const markRead = (ids: string[]) => { const next = new Set(read); ids.forEach((i) => next.add(i)); setRead(next); writeSet(next); };
  const openAlert = (a: Alert) => { markRead([a.id]); setOpen(false); go(a.to); };
  const list = tab === 'yeni' ? unread : alerts;

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen(!open)} aria-label={`Bildirimler (${unread.length} yeni)`}
        className={cx('relative p-2 rounded-xl ring-1 ring-line bg-card text-ink-2 hover:text-ink', open && 'ring-brand/60 text-brand')}>
        {unread.length > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {unread.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-stop text-white text-[11px] font-bold grid place-items-center tc-num">{unread.length}</span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Bildirim merkezi"
          className="tc-holo-in fixed sm:absolute inset-x-2 sm:inset-x-auto top-16 sm:top-auto sm:right-0 sm:mt-2 sm:w-[420px] z-50 rounded-2xl bg-card ring-1 ring-line shadow-2xl overflow-hidden">
          <div className="p-4 bg-gradient-to-br from-brand-soft via-card to-accent-soft border-b border-line">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full tc-holo px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"><Sparkles className="w-3.5 h-3.5" /> Asistan</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg text-ink-3 hover:text-ink" aria-label="Kapat"><X className="w-4 h-4" /></button>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">{summary}</p>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
            <div className="flex gap-1">
              {(['yeni', 'hepsi'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={cx('rounded-full px-3 py-1 text-xs font-semibold', tab === t ? 'bg-ink text-surface' : 'text-ink-3 hover:bg-surface-2')}>
                  {t === 'yeni' ? `Okunmamış (${unread.length})` : `Tümü (${alerts.length})`}
                </button>
              ))}
            </div>
            {unread.length > 0 && (
              <button type="button" onClick={() => markRead(unread.map((a) => a.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                <CheckCheck className="w-3.5 h-3.5" /> Tümünü okundu say
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto tc-scroll p-2">
            {list.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-3">{tab === 'yeni' ? 'Yeni bildirim yok 🎉' : 'Bildirim yok'}</li>}
            {list.map((a) => {
              const Icon = KIND_ICON[a.kind] ?? AlertTriangle;
              const isNew = !read.has(a.id);
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => openAlert(a)} className="w-full text-left flex gap-3 rounded-xl p-2.5 hover:bg-surface-2">
                    <span className={cx('w-9 h-9 shrink-0 rounded-xl grid place-items-center', TONE_CLS[a.tone])}><Icon className="w-[18px] h-[18px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className={cx('text-[13px] leading-snug', isNew ? 'font-bold text-ink' : 'font-medium text-ink-2')}>{a.title}</span>
                        {isNew && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-brand" aria-label="yeni" />}
                      </span>
                      <span className="block text-xs text-ink-3 mt-0.5 leading-snug">{a.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
