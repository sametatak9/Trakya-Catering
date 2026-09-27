import { useMemo, useState } from 'react';
import { askConfirm } from '@/ui/confirm';
import { Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useCan } from '@/app/session';
import { MEALS, MENU_KINDS, ROLES } from '@/lib/domain';
import { foodCostPct } from '@/lib/cost';
import { fmtMoney, fmtNum, fmtPct, parseNum } from '@/lib/format';
import { COURSE_LABELS, COURSE_ORDER, type Course } from '@/lib/prep';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { Button, Drawer, EmptyState, ErrorNote, Field, Loading, ModuleHero, Money, Panel, Pill, cx, type Tone } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useCustomers } from '../sales/api';
import { ServiceStylesPanel, useStyleCosts, type StyleCost } from './ServiceStyles';
import { useRows } from '@/lib/crud';
import { supabase } from '@/lib/supabase';
import { useDeleteMenu, useMenu, useMenuCosts, useRecipeCosts, useSaveMenu, type MenuCost, type MenuHeaderDraft } from './api';

/** Toplu yemekte hammadde maliyeti satışın ~%35–45'i civarında hedeflenir */
function foodCostTone(pct: number | null): Tone {
  if (pct === null) return 'idle';
  if (pct <= 40) return 'ok';
  if (pct <= 50) return 'wait';
  return 'stop';
}

/** Reçete kategorisinden varsayılan kap türü */
function courseFromCategory(cat: string | null | undefined): Course {
  switch (cat) {
    case 'corba': return 'corba';
    case 'pilav_makarna': return 'yardimci';
    case 'salata_meze': return 'salata';
    case 'tatli': return 'tatli';
    case 'icecek': return 'icecek';
    case 'ekmek': return 'ekmek';
    case 'kahvalti': return 'kahvalti';
    default: return 'ana';
  }
}

export function MenusPage() {
  const menus = useMenuCosts();
  const customers = useCustomers();
  const styleCosts = useStyleCosts();
  const canEdit = useCan(ROLES.kitchenWrite);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [cust, setCust] = useState('');
  const list = menus.data ?? [];
  const custName = (id: string | null) => (customers.data ?? []).find((c) => c.id === id)?.name ?? null;
  const shown = list.filter((m) => matches(q, m.name) && (!kind || m.kind === kind)
    && (!cust || (cust === 'genel' ? !m.customer_id : m.customer_id === cust)));

  const priced = list.filter((m) => m.target_price && (m.item_count ?? 0) > 0);
  const avgFc = priced.length
    ? priced.reduce((s, m) => s + (foodCostPct(Number(m.cost_last), Number(m.target_price)) ?? 0), 0) / priced.length : null;

  const listReport = (): ReportSpec => ({
    title: 'Menü Maliyet Listesi',
    subtitle: `${shown.length} menü · reçetelere göre güncel maliyet`,
    summary: shown.map((m) => ({ label: m.name ?? '', value: `${fmtMoney(m.cost_last)} maliyet${m.target_price ? ` · satış ${fmtMoney(m.target_price)}` : ''}` })),
    table: {
      filename: 'menu-maliyetleri',
      header: ['Menü', 'Tür', 'Öğün', 'Firma', 'Kap', 'Maliyet ₺', 'Satış ₺', 'Food cost %'],
      rows: shown.map((m) => [m.name, MENU_KINDS[m.kind ?? ''], MEALS[m.meal ?? ''], custName(m.customer_id ?? null) ?? 'Genel', m.item_count, m.cost_last, m.target_price,
        foodCostPct(Number(m.cost_last), m.target_price === null ? null : Number(m.target_price))]),
    },
    body: () => (
      <table>
        <thead><tr><th>Menü</th><th>Tür</th><th>Firma</th><th className="num">Kap</th><th className="num">Maliyet</th><th className="num">Satış</th><th className="num">Food cost</th></tr></thead>
        <tbody>
          {shown.map((m) => {
            const fc = foodCostPct(Number(m.cost_last), m.target_price === null ? null : Number(m.target_price));
            return <tr key={m.menu_id}><td>{m.name}</td><td>{MENU_KINDS[m.kind ?? '']} · {MEALS[m.meal ?? '']}</td><td>{custName(m.customer_id ?? null) ?? 'Genel'}</td>
              <td className="num">{m.item_count}</td><td className="num">{fmtMoney(m.cost_last)}</td><td className="num">{fmtMoney(m.target_price)}</td><td className="num">{fc === null ? '—' : fmtPct(fc)}</td></tr>;
          })}
        </tbody>
      </table>
    ),
  });

  return (
    <>
      <ModuleHero
        kicker="Mutfak · Kombinasyonlar"
        title="Menüler"
        description="Kap sayısı serbest: 3, 4, 5, 6 çeşit; kahvaltı, soğuk mezeli, diyet menüler ve firmaya özel menüler. Maliyet reçetelerden, satış fiyatına göre food cost anında görünür."
        actions={<>
          <ReportButton spec={listReport} disabled={list.length === 0} />
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Yeni menü</Button>}
        </>}
        stats={[
          { label: 'Menü', value: list.length, hint: `${list.filter((m) => m.customer_id).length} firmaya özel` },
          { label: 'Ort. food cost', value: avgFc === null ? '—' : fmtPct(avgFc), tone: avgFc !== null && avgFc > 45 ? 'warn' : 'default', hint: 'malzeme ÷ satış' },
          { label: 'Fiyatsız menü', value: list.filter((m) => !m.target_price).length },
          { label: 'Eksik fiyatlı kalem', value: list.reduce((s, m) => s + (m.missing_price_count ?? 0), 0), tone: list.some((m) => (m.missing_price_count ?? 0) > 0) ? 'warn' : 'default' },
        ]}
      />

      <Panel pad={false}>
        <ListToolbar search={q} onSearch={setQ} placeholder="Menü ara…"
          filters={<>
            <select className="tc-input !w-auto" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tür">
              <option value="">Tüm türler</option>
              {Object.entries(MENU_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="tc-input !w-auto" value={cust} onChange={(e) => setCust(e.target.value)} aria-label="Firma">
              <option value="">Genel + firmalar</option>
              <option value="genel">Yalnız genel</option>
              {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>} />
        <div className="p-4">
          {menus.isLoading ? <Loading /> : menus.error ? <ErrorNote>Menüler yüklenemedi.</ErrorNote>
            : list.length === 0 ? (
              <EmptyState icon={<UtensilsCrossed className="w-5 h-5" />} title="Henüz menü yok"
                action={canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>İlk menüyü oluştur</Button>}>
                Örn. Yayla Çorbası + Orman Kebabı + Pirinç Pilavı + Salata + Ayran (5 kap).
              </EmptyState>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {shown.map((m) => <MenuCard key={m.menu_id} m={m} customer={custName(m.customer_id ?? null)} styles={styleCosts.data ?? []} onOpen={() => setEditing(m.menu_id!)} />)}
                {shown.length === 0 && <p className="text-sm text-ink-3 col-span-full py-6 text-center">Filtreye uyan menü yok.</p>}
              </div>
            )}
        </div>
      </Panel>

      <ServiceStylesPanel />
      {editing && <MenuDrawer id={editing === 'new' ? null : editing} onClose={() => setEditing(null)} canEdit={canEdit} />}
    </>
  );
}

function MenuCard({ m, customer, styles, onOpen }: { m: MenuCost; customer: string | null; styles: StyleCost[]; onOpen: () => void }) {
  const fc = foodCostPct(Number(m.cost_last), m.target_price === null ? null : Number(m.target_price));
  return (
    <button type="button" onClick={onOpen} className={cx('tc-card p-4 text-left hover:ring-2 hover:ring-brand-soft transition', !m.active && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-brand">{MENU_KINDS[m.kind ?? ''] ?? m.kind} · {MEALS[m.meal ?? ''] ?? m.meal} · {m.item_count} kap</div>
          <h3 className="text-base font-semibold text-ink truncate mt-0.5">{m.name}</h3>
          {customer && <div className="text-[11px] text-info font-semibold mt-0.5">{customer} için</div>}
        </div>
        <Pill tone={foodCostTone(fc)}>{fc === null ? 'Fiyat yok' : `FC ${fmtPct(fc, 0)}`}</Pill>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div className="rounded-xl bg-surface-2 py-2"><div className="text-[10px] text-ink-3">Maliyet</div><Money value={m.cost_last} className="text-sm font-bold text-ink" /></div>
        <div className="rounded-xl bg-surface-2 py-2"><div className="text-[10px] text-ink-3">Satış</div><Money value={m.target_price} className="text-sm font-bold text-ink" /></div>
        <div className="rounded-xl bg-surface-2 py-2"><div className="text-[10px] text-ink-3">Brüt kâr</div>
          <Money value={m.target_price ? Number(m.target_price) - Number(m.cost_last) : null} className="text-sm font-bold text-ok" /></div>
      </div>
      {styles.some((s) => Number(s.pack_cost_per_person) > 0) && (
        <div className="mt-3 text-[11px] text-ink-3">Gıda + ambalaj: {styles.filter((s) => Number(s.pack_cost_per_person) > 0).map((s) => `${s.name} ${fmtMoney(Number(m.cost_last) + Number(s.pack_cost_per_person))}`).join(' · ')}</div>
      )}
      {(m.missing_price_count ?? 0) > 0 && <div className="text-[11px] text-wait mt-3">{m.missing_price_count} kalemin fiyatı eksik</div>}
    </button>
  );
}

function MenuDrawer({ id, onClose, canEdit }: { id: string | null; onClose: () => void; canEdit: boolean }) {
  const menu = useMenu(id);
  const recipes = useRecipeCosts();
  const m = menu.data?.menu;
  const menuItems = menu.data?.items;
  if ((id && menu.isLoading) || recipes.isLoading) {
    return <Drawer open onClose={onClose} title="Menü"><Loading /></Drawer>;
  }
  return (
    <MenuForm key={id ?? 'new'} id={id} onClose={onClose} canEdit={canEdit} initialType={m?.menu_type_code ?? ''}
      initial={m ? {
        code: m.code ?? '', name: m.name, kind: m.kind, meal: m.meal, target_price: m.target_price, notes: m.notes ?? '', active: m.active, customer_id: m.customer_id,
      } : { code: '', name: '', kind: 'standart', meal: 'ogle', target_price: null, notes: '', active: true, customer_id: null }}
      initialItems={(menuItems ?? []).map((i) => ({ recipeId: i.recipe_id, factor: String(i.portion_factor).replace('.', ','), course: i.course as Course }))}
      recipes={recipes.data ?? []}
    />
  );
}

interface ItemDraft { recipeId: string; factor: string; course: Course }

function MenuForm({ id, onClose, canEdit, initial, initialItems, recipes, initialType }: {
  id: string | null; onClose: () => void; canEdit: boolean; initial: MenuHeaderDraft; initialType: string;
  initialItems: ItemDraft[]; recipes: NonNullable<ReturnType<typeof useRecipeCosts>['data']>;
}) {
  const toast = useToast();
  const save = useSaveMenu();
  const del = useDeleteMenu();
  const customers = useCustomers();
  const [h, setH] = useState<MenuHeaderDraft>(initial);
  const [items, setItems] = useState(initialItems);
  const [adding, setAdding] = useState('');
  const [price, setPrice] = useState(initial.target_price === null ? '' : String(initial.target_price).replace('.', ','));
  const [err, setErr] = useState<string | null>(null);
  const [typeCode, setTypeCode] = useState(initialType);
  const types = useRows('menu_types', { order: 'sort' });
  const styleCosts = useStyleCosts();

  const byId = useMemo(() => new Map(recipes.map((r) => [r.recipe_id!, r])), [recipes]);
  const rows = items.map((it, idx) => {
    const r = byId.get(it.recipeId);
    const f = parseNum(it.factor) ?? 0;
    return { it, idx, r, f, cost: r ? Number(r.cost_last) * f : 0 };
  });
  const total = rows.reduce((s, x) => s + x.cost, 0);
  const priceN = price.trim() ? parseNum(price) : null;
  const fc = foodCostPct(total, priceN);
  const custName = (cid: string | null) => (customers.data ?? []).find((c) => c.id === cid)?.name ?? null;
  const upd = (idx: number, patch: Partial<ItemDraft>) => setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const submit = async () => {
    setErr(null);
    if (!h.name.trim()) return setErr('Menü adı zorunlu.');
    if (price.trim() && (priceN === null || priceN < 0)) return setErr('Satış fiyatı geçersiz.');
    if (rows.some((x) => x.f <= 0)) return setErr('Porsiyon katsayısı 0’dan büyük olmalı.');
    try {
      const savedId = await save.mutateAsync({
        id, header: { ...h, name: h.name.trim(), target_price: priceN },
        items: rows.map((x) => ({ recipe_id: x.it.recipeId, portion_factor: x.f, course: x.it.course })),
      });
      const menuId = (typeof savedId === 'string' ? savedId : null) ?? id;
      if (menuId && typeCode !== initialType) {
        const { error } = await supabase.from('menus').update({ menu_type_code: typeCode || null }).eq('id', menuId);
        if (error) throw error;
      }
      toast.ok('Menü kaydedildi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  const remove = async () => {
    if (!id || !await askConfirm(`"${h.name}" menüsü silinsin mi?`)) return;
    try { await del.mutateAsync(id); toast.ok('Menü silindi'); onClose(); } catch (e) { toast.error(e); }
  };

  const card = (): ReportSpec => ({
    title: 'Menü Maliyet Kartı',
    subtitle: `${h.name} · ${MENU_KINDS[h.kind]} · ${MEALS[h.meal]}${h.customer_id ? ` · ${custName(h.customer_id)}` : ''}`,
    summary: [
      ...rows.map((x) => ({ label: `${COURSE_LABELS[x.it.course]}: ${x.r?.name ?? ''}`, value: fmtMoney(x.cost) })),
      { label: 'Kişi başı maliyet', value: fmtMoney(total) },
      ...(priceN !== null ? [{ label: 'Satış', value: fmtMoney(priceN) }] : []),
    ],
    body: () => (
      <>
        <ReportStats items={[
          { label: 'Kap', value: rows.length },
          { label: 'Kişi başı maliyet', value: fmtMoney(total) },
          { label: 'Satış (KDV hariç)', value: fmtMoney(priceN) },
          { label: 'Food cost', value: fc === null ? '—' : fmtPct(fc) },
        ]} />
        <ReportSection title="Kaplar">
          <table>
            <thead><tr><th>Kap</th><th>Yemek</th><th className="num">Katsayı</th><th className="num">Porsiyon maliyeti</th><th className="num">Menüde</th></tr></thead>
            <tbody>
              {[...rows].sort((a, b) => COURSE_ORDER.indexOf(a.it.course) - COURSE_ORDER.indexOf(b.it.course)).map((x) => (
                <tr key={x.it.recipeId}><td>{COURSE_LABELS[x.it.course]}</td><td>{x.r?.name}</td><td className="num">{fmtNum(x.f, 2)}</td>
                  <td className="num">{fmtMoney(x.r?.cost_last)}</td><td className="num"><b>{fmtMoney(x.cost)}</b></td></tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      </>
    ),
  });

  return (
    <Drawer open wide onClose={onClose} title={id ? h.name || 'Menü' : 'Yeni menü'} subtitle="Kaplar, porsiyon katsayısı, firma ve hedef fiyat"
      footer={<>
        {id && canEdit && <Button variant="danger" className="mr-auto" icon={<Trash2 className="w-4 h-4" />} onClick={remove} loading={del.isPending}>Sil</Button>}
        {rows.length > 0 && <ReportButton spec={card} label="Maliyet kartı" />}
        {canEdit && <><Button onClick={onClose}>Vazgeç</Button><Button variant="holo" onClick={submit} loading={save.isPending}>Kaydet</Button></>}
      </>}>
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Menü adı" className="col-span-2"><input className="tc-input" value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} placeholder="Standart Öğle 5 Kap" /></Field>
          <Field label="Kod"><input className="tc-input" value={h.code} onChange={(e) => setH({ ...h, code: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Tür">
            <select className="tc-input" value={h.kind} onChange={(e) => setH({ ...h, kind: e.target.value, meal: e.target.value === 'kahvalti' ? 'kahvalti' : h.meal })}>
              {Object.entries(MENU_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Menü tipi">
            <select className="tc-input" value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
              <option value="">—</option>
              {(types.data ?? []).filter((t) => t.active).map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Öğün">
            <select className="tc-input" value={h.meal} onChange={(e) => setH({ ...h, meal: e.target.value })}>
              {Object.entries(MEALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Firma" hint="Boşsa genel menü">
            <select className="tc-input" value={h.customer_id ?? ''} onChange={(e) => setH({ ...h, customer_id: e.target.value || null })}>
              <option value="">Genel</option>
              {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Kişi başı satış ₺" hint="KDV hariç">
            <input className="tc-input tc-num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
          </Field>
        </div>

        <div className="rounded-2xl ring-1 ring-line bg-card">
          <div className="px-4 py-3 border-b border-line flex justify-between items-center">
            <span className="text-sm font-semibold text-ink">Kaplar</span>
            <span className="text-xs text-ink-3">{rows.length} kap</span>
          </div>
          <ul className="divide-y divide-line">
            {[...rows].sort((a, b) => COURSE_ORDER.indexOf(a.it.course) - COURSE_ORDER.indexOf(b.it.course)).map((x) => (
              <li key={x.it.recipeId} className="grid grid-cols-[140px_1fr_64px_auto_28px] items-center gap-2 px-4 py-2.5">
                <select className="tc-input !py-1.5 !px-2 text-xs" value={x.it.course} onChange={(e) => upd(x.idx, { course: e.target.value as Course })} aria-label="Kap türü">
                  {COURSE_ORDER.map((c) => <option key={c} value={c}>{COURSE_LABELS[c]}</option>)}
                </select>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{x.r?.name ?? 'Silinmiş reçete'}</div>
                  <div className="text-[11px] text-ink-3">Porsiyon <Money value={x.r?.cost_last} /></div>
                </div>
                <input className="tc-input tc-num !py-1.5 !px-2 text-right" inputMode="decimal" value={x.it.factor} title="Porsiyon katsayısı (ağır işçi 1,2 gibi)"
                  onChange={(e) => upd(x.idx, { factor: e.target.value })} aria-label="Porsiyon katsayısı" />
                <Money value={x.cost} className="w-24 text-right text-sm font-semibold text-ink" />
                {canEdit ? (
                  <button type="button" onClick={() => setItems(items.filter((_, i) => i !== x.idx))} className="p-1 text-ink-3 hover:text-stop" aria-label="Kaldır">
                    <X className="w-4 h-4" />
                  </button>
                ) : <span />}
              </li>
            ))}
            {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">Kap eklenmedi.</li>}
          </ul>
          {canEdit && (
            <div className="flex gap-2 p-3 border-t border-line">
              <select className="tc-input flex-1" value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">Reçete seç…</option>
                {recipes.filter((r) => r.active && !items.some((i) => i.recipeId === r.recipe_id))
                  .map((r) => <option key={r.recipe_id} value={r.recipe_id!}>{r.name}</option>)}
              </select>
              <Button icon={<Plus className="w-4 h-4" />} disabled={!adding}
                onClick={() => { setItems([...items, { recipeId: adding, factor: '1', course: courseFromCategory(byId.get(adding)?.category_code) }]); setAdding(''); }}>Ekle</Button>
            </div>
          )}
        </div>

        <Field label="Not"><textarea className="tc-input" rows={2} value={h.notes} onChange={(e) => setH({ ...h, notes: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={h.active} onChange={(e) => setH({ ...h, active: e.target.checked })} className="accent-[var(--tc-brand)]" /> Aktif
        </label>
      </fieldset>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="tc-card px-3 py-2.5"><div className="text-[10px] text-ink-3">Kişi başı maliyet</div><Money value={total} className="text-base font-bold text-ink" /></div>
        <div className="tc-card px-3 py-2.5"><div className="text-[10px] text-ink-3">Food cost</div>
          <div className={cx('tc-num text-base font-bold', fc === null ? 'text-ink-3' : fc <= 40 ? 'text-ok' : fc <= 50 ? 'text-wait' : 'text-stop')}>{fc === null ? '—' : fmtPct(fc)}</div></div>
        <div className="tc-card px-3 py-2.5"><div className="text-[10px] text-ink-3">Brüt kâr / kişi</div><Money value={priceN === null ? null : priceN - total} className="text-base font-bold text-ok" /></div>
      </div>
      {(styleCosts.data ?? []).length > 0 && (
        <div className="mt-2 overflow-hidden rounded-2xl ring-1 ring-line">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-ink-3"><th className="px-3 py-2">Sunum</th><th className="px-3 py-2 text-right">Gıda</th><th className="px-3 py-2 text-right">Gıda + ambalaj</th></tr></thead>
            <tbody>{(styleCosts.data ?? []).map((sc) => (
              <tr key={sc.code} className="border-t border-line"><td className="px-3 py-1.5">{sc.name}</td><td className="px-3 py-1.5 text-right"><Money value={total} /></td>
                <td className="px-3 py-1.5 text-right font-semibold"><Money value={total + Number(sc.pack_cost_per_person ?? 0)} />{!Number(sc.pack_cost_per_person) && <span className="ml-1 text-[11px] font-normal text-ink-3">(ambalaj tanımsız)</span>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-ink-3 mt-2">Maliyet reçetelerden (son alış fiyatı). Günün gerçekleşen maliyeti “Günlük Hazırlık” ekranında görünür.</p>
      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
    </Drawer>
  );
}
