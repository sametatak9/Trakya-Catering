import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, Plus, Save, Trash2, X } from 'lucide-react';
import { Link, useRouter } from '@/app/router';
import { useCan } from '@/app/session';
import { ALLERGENS, unitInfo, ROLES } from '@/lib/domain';
import { lineCost } from '@/lib/cost';
import { fmtNum, fmtPct, fmtQty, parseNum } from '@/lib/format';
import { Button, ErrorNote, Field, Loading, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import {
  useCategories, useDeleteRecipe, useIngredients, useRecipe, useRecipeLines, useSaveRecipe,
  type Ingredient, type RecipeHeaderDraft,
} from './api';

interface DraftLine { ingredientId: string; net: string; wasteOverride: string; note: string }

const EMPTY_HEADER: RecipeHeaderDraft = {
  code: '', name: '', category_code: 'ana_yemek', portion_label: '', portion_served_g: null, instructions: '', active: true,
};

export function RecipeEditor({ id }: { id: string | null }) {
  const recipe = useRecipe(id);
  const lines = useRecipeLines(id);
  const ingredients = useIngredients();
  const r = recipe.data;
  const lineData = lines.data;
  if (id && (recipe.isLoading || lines.isLoading)) return <Loading />;
  if (ingredients.isLoading) return <Loading />;
  if (id && recipe.error) return <ErrorNote>Reçete bulunamadı.</ErrorNote>;
  return (
    <EditorBody
      key={id ?? 'new'}
      id={id}
      initialHeader={r ? {
        code: r.code ?? '', name: r.name, category_code: r.category_code,
        portion_label: r.portion_label ?? '', portion_served_g: r.portion_served_g,
        instructions: r.instructions ?? '', active: r.active,
      } : EMPTY_HEADER}
      initialLines={(lineData ?? []).map((l) => ({
        ingredientId: l.ingredient_id!, net: fmtInput(l.net_qty), wasteOverride: l.waste_pct_override === null ? '' : fmtInput(l.waste_pct_override), note: l.note ?? '',
      }))}
      ingredients={ingredients.data ?? []}
    />
  );
}

function fmtInput(v: number | null | undefined) { return v === null || v === undefined ? '' : String(Number(v)).replace('.', ','); }

function EditorBody({ id, initialHeader, initialLines, ingredients }: {
  id: string | null; initialHeader: RecipeHeaderDraft; initialLines: DraftLine[]; ingredients: Ingredient[];
}) {
  const { go } = useRouter();
  const toast = useToast();
  const canEdit = useCan(ROLES.kitchenWrite);
  const cats = useCategories();
  const save = useSaveRecipe();
  const del = useDeleteRecipe();

  const [h, setH] = useState<RecipeHeaderDraft>(initialHeader);
  const [draft, setDraft] = useState<DraftLine[]>(initialLines);
  const [adding, setAdding] = useState('');
  const [portions, setPortions] = useState('1000');
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const upd = (patch: Partial<RecipeHeaderDraft>) => { setH((x) => ({ ...x, ...patch })); setDirty(true); };
  const updLine = (idx: number, patch: Partial<DraftLine>) => { setDraft((xs) => xs.map((l, i) => (i === idx ? { ...l, ...patch } : l))); setDirty(true); };

  // Canlı hesap: veritabanındaki v_recipe_lines ile aynı formül (lib/cost.ts)
  const computed = draft.map((l) => {
    const ing = byId.get(l.ingredientId);
    const net = parseNum(l.net);
    const override = l.wasteOverride.trim() ? parseNum(l.wasteOverride) : null;
    const waste = override ?? Number(ing?.waste_pct ?? 0);
    const u = unitInfo(ing?.stock_unit ?? 'adet');
    const valid = ing && net !== null && net > 0 && waste >= 0 && waste < 100;
    const r = valid ? lineCost({ netQty: net, wastePct: waste, unitToBase: u.toBase, price: ing.last_price }) : null;
    return { l, ing, net, waste, unit: u, r, valid };
  });
  const total = computed.reduce((s, c) => s + (c.r?.cost ?? 0), 0);
  const missingPrice = computed.filter((c) => c.valid && c.r?.cost === null).length;
  const netGrams = computed.filter((c) => c.unit.base === 'g').reduce((s, c) => s + (c.net ?? 0), 0);
  const allergens = Array.from(new Set(computed.flatMap((c) => c.ing?.allergens ?? []))).sort();
  const portionsN = parseNum(portions) ?? 0;
  const available = ingredients.filter((i) => i.active && !draft.some((d) => d.ingredientId === i.id));

  const submit = async () => {
    setErr(null);
    if (!h.name.trim()) return setErr('Reçete adı zorunlu.');
    const bad = computed.find((c) => !c.valid);
    if (bad) return setErr(`"${bad.ing?.name ?? 'Satır'}" için net miktar > 0 ve fire 0–99,99 olmalı.`);
    try {
      const newId = await save.mutateAsync({
        id,
        header: { ...h, name: h.name.trim() },
        lines: computed.map((c) => ({
          ingredient_id: c.l.ingredientId, net_qty: c.net!, note: c.l.note.trim(),
          waste_pct_override: c.l.wasteOverride.trim() ? parseNum(c.l.wasteOverride) : null,
        })),
      });
      setDirty(false);
      toast.ok('Reçete kaydedildi');
      if (!id) go(`/receteler/${newId}`);
    } catch (e) { toast.error(e); }
  };

  const remove = async () => {
    if (!id || !window.confirm(`"${h.name}" reçetesi silinsin mi? Menülerde kullanılıyorsa silinemez; pasife alın.`)) return;
    try { await del.mutateAsync(id); toast.ok('Reçete silindi'); go('/receteler'); } catch (e) { toast.error(e); }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div className="min-w-0">
          <Link to="/receteler" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-brand mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Reçeteler
          </Link>
          <h1 className="text-2xl sm:text-[28px] font-bold text-ink truncate">{h.name || (id ? 'Reçete' : 'Yeni reçete')}</h1>
          <div className="tc-harvest-rule w-16 mt-3" />
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {id && <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={remove} loading={del.isPending}>Sil</Button>}
            <Button variant="primary" icon={<Save className="w-4 h-4" />} onClick={submit} loading={save.isPending} disabled={!dirty && Boolean(id)}>Kaydet</Button>
          </div>
        )}
      </div>

      {err && <div className="mb-4"><ErrorNote>{err}</ErrorNote></div>}

      <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Panel title="Reçete bilgisi">
            <fieldset disabled={!canEdit} className="grid sm:grid-cols-6 gap-3">
              <Field label="Ad" className="sm:col-span-3"><input className="tc-input" value={h.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Orman Kebabı" /></Field>
              <Field label="Kategori" className="sm:col-span-2">
                <select className="tc-input" value={h.category_code} onChange={(e) => upd({ category_code: e.target.value })}>
                  {(cats.data ?? []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Kod"><input className="tc-input" value={h.code} onChange={(e) => upd({ code: e.target.value })} placeholder="R-012" /></Field>
              <Field label="Porsiyon tarifi" className="sm:col-span-3" hint="Servis ölçüsü, ör. 1 kepçe (250 ml)">
                <input className="tc-input" value={h.portion_label} onChange={(e) => upd({ portion_label: e.target.value })} />
              </Field>
              <Field label="Pişmiş porsiyon (g)" className="sm:col-span-2" hint={h.portion_served_g && netGrams ? `Çiğ net ${fmtNum(netGrams, 0)} g → verim ${fmtPct((h.portion_served_g / netGrams) * 100, 0)}` : 'Tabağa giden ağırlık'}>
                <input className="tc-input tc-num" inputMode="decimal" value={fmtInput(h.portion_served_g)} onChange={(e) => upd({ portion_served_g: parseNum(e.target.value) })} />
              </Field>
              <label className="flex items-end gap-2 pb-2.5 text-sm text-ink-2">
                <input type="checkbox" checked={h.active} onChange={(e) => upd({ active: e.target.checked })} className="accent-[var(--tc-brand)]" /> Aktif
              </label>
            </fieldset>
          </Panel>

          <Panel title="1 porsiyon gramaj" subtitle="Net = temizlenmiş, tencereye giren miktar. Brüt = depodan çıkan (fire dahil)." pad={false}>
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                    <th className="px-4 py-2.5 font-semibold">Hammadde</th>
                    <th className="px-2 py-2.5 font-semibold w-28">Net</th>
                    <th className="px-2 py-2.5 font-semibold w-24">Fire %</th>
                    <th className="px-2 py-2.5 font-semibold text-right">Brüt</th>
                    <th className="px-2 py-2.5 font-semibold text-right">Birim fiyat</th>
                    <th className="px-2 py-2.5 font-semibold text-right">Maliyet</th>
                    <th className="px-2 py-2.5 font-semibold text-right w-16">Pay</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {computed.map((c, idx) => (
                    <tr key={c.l.ingredientId} className="border-b border-line">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-ink">{c.ing?.name ?? 'Silinmiş hammadde'}</div>
                        <input className="mt-1 w-full bg-transparent text-[11px] text-ink-3 placeholder:text-ink-3/60 focus:outline-none"
                          placeholder="not ekle (ör. küp doğranmış)" value={c.l.note} disabled={!canEdit}
                          onChange={(e) => updLine(idx, { note: e.target.value })} />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          <input className="tc-input tc-num !py-1.5 !px-2 text-right" inputMode="decimal" value={c.l.net} disabled={!canEdit}
                            onChange={(e) => updLine(idx, { net: e.target.value })} aria-label="Net miktar" />
                          <span className="text-xs text-ink-3 w-8">{c.unit.base}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <input className="tc-input tc-num !py-1.5 !px-2 text-right" inputMode="decimal" value={c.l.wasteOverride} disabled={!canEdit}
                          placeholder={fmtInput(c.ing?.waste_pct ?? 0)} title="Boş bırakılırsa hammadde kartındaki fire kullanılır"
                          onChange={(e) => updLine(idx, { wasteOverride: e.target.value })} aria-label="Fire yüzdesi" />
                      </td>
                      <td className="px-2 py-2.5 text-right tc-num text-ink-2 whitespace-nowrap">{c.r ? fmtQty(c.r.gross, c.unit.base) : '—'}</td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap">
                        {c.ing?.last_price == null ? <Pill tone="wait">Yok</Pill>
                          : <span className="text-xs text-ink-3"><Money value={c.ing.last_price} className="text-ink-2" />/{c.ing.stock_unit}</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold whitespace-nowrap"><Money value={c.r?.cost ?? null} precise /></td>
                      <td className="px-2 py-2.5 text-right tc-num text-xs text-ink-3">{c.r?.cost != null && total > 0 ? fmtPct((c.r.cost / total) * 100, 0) : ''}</td>
                      <td className="pr-3">
                        {canEdit && (
                          <button type="button" className="p-1.5 rounded-lg text-ink-3 hover:text-stop hover:bg-stop-soft" aria-label="Satırı kaldır"
                            onClick={() => { setDraft((xs) => xs.filter((_, i) => i !== idx)); setDirty(true); }}>
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {draft.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-3">Henüz hammadde eklenmedi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="flex flex-col sm:flex-row gap-2 p-4 border-t border-line bg-surface-2/60 rounded-b-[18px]">
                <select className="tc-input flex-1" value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">Hammadde seç…</option>
                  {available.map((i) => <option key={i.id} value={i.id}>{i.name} ({unitInfo(i.stock_unit).base})</option>)}
                </select>
                <Button icon={<Plus className="w-4 h-4" />} disabled={!adding}
                  onClick={() => { setDraft((xs) => [...xs, { ingredientId: adding, net: '', wasteOverride: '', note: '' }]); setAdding(''); setDirty(true); }}>
                  Satır ekle
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="Hazırlanış" subtitle="Aşçı notları, pişirme sırası, servis talimatı">
            <textarea className="tc-input" rows={4} value={h.instructions} disabled={!canEdit} onChange={(e) => upd({ instructions: e.target.value })} />
          </Panel>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="tc-card overflow-hidden">
            <div className="bg-brand text-on-brand px-5 py-4">
              <div className="text-xs font-semibold opacity-80">Porsiyon hammadde maliyeti</div>
              <div className="tc-num text-3xl font-bold mt-1">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}</div>
              <div className="text-xs opacity-80 mt-1">Son alış fiyatlarıyla · KDV hariç</div>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-3">Kalem</span><span className="tc-num text-ink">{draft.length}</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Çiğ net (katı)</span><span className="tc-num text-ink">{fmtQty(netGrams, 'g')}</span></div>
              {missingPrice > 0 && <div className="rounded-xl bg-wait-soft text-wait px-3 py-2 text-xs font-medium">{missingPrice} kalemin fiyatı yok — maliyet eksik.</div>}
              {dirty && <div className="rounded-xl bg-accent-soft text-accent-strong px-3 py-2 text-xs font-medium">Kaydedilmemiş değişiklik var.</div>}
            </div>
            {allergens.length > 0 && (
              <div className="px-5 pb-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">Alerjenler</div>
                <div className="flex flex-wrap gap-1">{allergens.map((a) => <Pill key={a} tone="accent">{ALLERGENS[a] ?? a}</Pill>)}</div>
              </div>
            )}
          </div>

          <Panel title={<span className="inline-flex items-center gap-2"><Calculator className="w-4 h-4 text-brand" /> Üretim ön-hesabı</span>}
            subtitle="N porsiyon için depodan çıkacak brüt miktar">
            <Field label="Porsiyon sayısı">
              <input className="tc-input tc-num" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} />
            </Field>
            <ul className="mt-3 divide-y divide-line">
              {computed.filter((c) => c.r).map((c) => (
                <li key={c.l.ingredientId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-ink-2 truncate">{c.ing?.name}</span>
                  <span className="tc-num font-semibold text-ink whitespace-nowrap">{fmtQty(c.r!.gross * portionsN, c.unit.base)}</span>
                </li>
              ))}
            </ul>
            <div className={cx('flex justify-between pt-3 mt-1 border-t border-line text-sm', computed.length === 0 && 'hidden')}>
              <span className="text-ink-3">Toplam hammadde</span>
              <Money value={total * portionsN} className="font-bold text-ink" />
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
