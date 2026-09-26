import { useMemo, useState } from 'react';
import { Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useCan } from '@/app/session';
import { MEALS, MENU_KINDS, ROLES } from '@/lib/domain';
import { foodCostPct } from '@/lib/cost';
import { fmtPct, parseNum } from '@/lib/format';
import { Button, Drawer, EmptyState, ErrorNote, Field, Loading, ModuleHero, Money, Pill, cx, type Tone } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useDeleteMenu, useMenu, useMenuCosts, useRecipeCosts, useSaveMenu, type MenuHeaderDraft } from './api';

/** Toplu yemekte hammadde maliyeti satışın ~%35–45'i civarında hedeflenir */
function foodCostTone(pct: number | null): Tone {
  if (pct === null) return 'idle';
  if (pct <= 40) return 'ok';
  if (pct <= 50) return 'wait';
  return 'stop';
}

export function MenusPage() {
  const menus = useMenuCosts();
  const canEdit = useCan(ROLES.kitchenWrite);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const list = menus.data ?? [];

  const priced = list.filter((m) => m.target_price && (m.item_count ?? 0) > 0);
  const avgFc = priced.length
    ? priced.reduce((s, m) => s + (foodCostPct(Number(m.cost_last), Number(m.target_price)) ?? 0), 0) / priced.length : null;

  return (
    <>
      <ModuleHero
        kicker="Mutfak · Kombinasyonlar"
        title="Menüler"
        description="3 kap / 4 kap menü kombinasyonları. Hedef satış fiyatına göre hammadde maliyet oranı (food cost) anlık görünür."
        actions={canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Yeni menü</Button>}
        stats={[
          { label: 'Menü', value: list.length },
          { label: 'Ort. food cost', value: avgFc === null ? '—' : fmtPct(avgFc), tone: avgFc !== null && avgFc > 45 ? 'warn' : 'default', hint: 'Hammadde / satış fiyatı' },
          { label: 'Fiyatsız menü', value: list.filter((m) => !m.target_price).length },
          { label: 'Eksik fiyatlı kalem', value: list.reduce((s, m) => s + (m.missing_price_count ?? 0), 0), tone: list.some((m) => (m.missing_price_count ?? 0) > 0) ? 'warn' : 'default' },
        ]}
      />

      {menus.isLoading ? <Loading /> : menus.error ? <ErrorNote>Menüler yüklenemedi.</ErrorNote>
        : list.length === 0 ? (
          <div className="tc-card">
            <EmptyState icon={<UtensilsCrossed className="w-5 h-5" />} title="Henüz menü yok"
              action={canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>İlk menüyü oluştur</Button>}>
              Örn. Yayla Çorbası + Orman Kebabı + Pirinç Pilavı + Ayran.
            </EmptyState>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((m) => {
              const fc = foodCostPct(Number(m.cost_last), m.target_price === null ? null : Number(m.target_price));
              return (
                <button key={m.menu_id} type="button" onClick={() => setEditing(m.menu_id!)}
                  className={cx('tc-card p-4 text-left hover:ring-2 hover:ring-brand-soft transition', !m.active && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-brand">{MENU_KINDS[m.kind ?? ''] ?? m.kind} · {MEALS[m.meal ?? ''] ?? m.meal}</div>
                      <h3 className="text-base font-semibold text-ink truncate mt-0.5">{m.name}</h3>
                    </div>
                    <Pill tone={foodCostTone(fc)}>{fc === null ? 'Fiyat yok' : `FC ${fmtPct(fc, 0)}`}</Pill>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="rounded-xl bg-surface-2 py-2"><div className="text-[10px] text-ink-3">Maliyet</div><Money value={m.cost_last} className="text-sm font-bold text-ink" /></div>
                    <div className="rounded-xl bg-surface-2 py-2"><div className="text-[10px] text-ink-3">Satış</div><Money value={m.target_price} className="text-sm font-bold text-ink" /></div>
                    <div className="rounded-xl bg-surface-2 py-2"><div className="text-[10px] text-ink-3">Brüt kâr</div>
                      <Money value={m.target_price ? Number(m.target_price) - Number(m.cost_last) : null} className="text-sm font-bold text-ok" /></div>
                  </div>
                  <div className="text-[11px] text-ink-3 mt-3">{m.item_count} kap{(m.missing_price_count ?? 0) > 0 ? ` · ${m.missing_price_count} kalemin fiyatı eksik` : ''}</div>
                </button>
              );
            })}
          </div>
        )}

      {editing && <MenuDrawer id={editing === 'new' ? null : editing} onClose={() => setEditing(null)} canEdit={canEdit} />}
    </>
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
    <MenuForm key={id ?? 'new'} id={id} onClose={onClose} canEdit={canEdit}
      initial={m ? {
        code: m.code ?? '', name: m.name, kind: m.kind, meal: m.meal, target_price: m.target_price, notes: m.notes ?? '', active: m.active,
      } : { code: '', name: '', kind: '4_kap', meal: 'ogle', target_price: null, notes: '', active: true }}
      initialItems={(menuItems ?? []).map((i) => ({ recipeId: i.recipe_id, factor: String(i.portion_factor).replace('.', ',') }))}
      recipes={recipes.data ?? []}
    />
  );
}

function MenuForm({ id, onClose, canEdit, initial, initialItems, recipes }: {
  id: string | null; onClose: () => void; canEdit: boolean; initial: MenuHeaderDraft;
  initialItems: Array<{ recipeId: string; factor: string }>; recipes: NonNullable<ReturnType<typeof useRecipeCosts>['data']>;
}) {
  const toast = useToast();
  const save = useSaveMenu();
  const del = useDeleteMenu();
  const [h, setH] = useState<MenuHeaderDraft>(initial);
  const [items, setItems] = useState(initialItems);
  const [adding, setAdding] = useState('');
  const [price, setPrice] = useState(initial.target_price === null ? '' : String(initial.target_price).replace('.', ','));
  const [err, setErr] = useState<string | null>(null);

  const byId = useMemo(() => new Map(recipes.map((r) => [r.recipe_id!, r])), [recipes]);
  const rows = items.map((it) => {
    const r = byId.get(it.recipeId);
    const f = parseNum(it.factor) ?? 0;
    return { it, r, f, cost: r ? Number(r.cost_last) * f : 0 };
  });
  const total = rows.reduce((s, x) => s + x.cost, 0);
  const priceN = price.trim() ? parseNum(price) : null;
  const fc = foodCostPct(total, priceN);

  const submit = async () => {
    setErr(null);
    if (!h.name.trim()) return setErr('Menü adı zorunlu.');
    if (price.trim() && (priceN === null || priceN < 0)) return setErr('Satış fiyatı geçersiz.');
    if (rows.some((x) => x.f <= 0)) return setErr('Porsiyon katsayısı 0’dan büyük olmalı.');
    try {
      await save.mutateAsync({
        id, header: { ...h, name: h.name.trim(), target_price: priceN },
        items: rows.map((x) => ({ recipe_id: x.it.recipeId, portion_factor: x.f })),
      });
      toast.ok('Menü kaydedildi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  const remove = async () => {
    if (!id || !window.confirm(`"${h.name}" menüsü silinsin mi?`)) return;
    try { await del.mutateAsync(id); toast.ok('Menü silindi'); onClose(); } catch (e) { toast.error(e); }
  };

  return (
    <Drawer open onClose={onClose} title={id ? h.name || 'Menü' : 'Yeni menü'} subtitle="Kaplar, porsiyon katsayısı ve hedef fiyat"
      footer={canEdit && (
        <>
          {id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="w-4 h-4" />} onClick={remove} loading={del.isPending}>Sil</Button>}
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" onClick={submit} loading={save.isPending}>Kaydet</Button>
        </>
      )}>
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Menü adı" className="col-span-2"><input className="tc-input" value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} placeholder="Standart Öğle 4 Kap" /></Field>
          <Field label="Kod"><input className="tc-input" value={h.code} onChange={(e) => setH({ ...h, code: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tip">
            <select className="tc-input" value={h.kind} onChange={(e) => setH({ ...h, kind: e.target.value })}>
              {Object.entries(MENU_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Öğün">
            <select className="tc-input" value={h.meal} onChange={(e) => setH({ ...h, meal: e.target.value })}>
              {Object.entries(MEALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Kişi başı satış ₺" hint="KDV hariç">
            <input className="tc-input tc-num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
          </Field>
        </div>

        <div className="rounded-2xl ring-1 ring-line bg-card">
          <div className="px-4 py-3 border-b border-line text-sm font-semibold text-ink">Kaplar</div>
          <ul className="divide-y divide-line">
            {rows.map((x, idx) => (
              <li key={x.it.recipeId} className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{x.r?.name ?? 'Silinmiş reçete'}</div>
                  <div className="text-[11px] text-ink-3">Porsiyon <Money value={x.r?.cost_last} /></div>
                </div>
                <input className="tc-input tc-num !w-16 !py-1.5 !px-2 text-right" inputMode="decimal" value={x.it.factor} title="Porsiyon katsayısı (ağır işçi 1,2 gibi)"
                  onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, factor: e.target.value } : it)))} aria-label="Porsiyon katsayısı" />
                <span className="text-xs text-ink-3">×</span>
                <Money value={x.cost} className="w-24 text-right text-sm font-semibold text-ink" />
                {canEdit && (
                  <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-1 text-ink-3 hover:text-stop" aria-label="Kaldır">
                    <X className="w-4 h-4" />
                  </button>
                )}
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
                onClick={() => { setItems([...items, { recipeId: adding, factor: '1' }]); setAdding(''); }}>Ekle</Button>
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
      <p className="text-[11px] text-ink-3 mt-2">Brüt kâr yalnızca hammaddeyi düşer; işçilik ve genel giderler Maliyet & Net Kâr modülünde (Faz 5) dağıtılacak.</p>

      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
    </Drawer>
  );
}
