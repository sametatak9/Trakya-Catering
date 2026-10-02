import { useMemo, useState } from 'react';
import { askConfirm } from '@/ui/confirm';
import { AlertTriangle, Plus, Search, Trash2, Wheat } from 'lucide-react';
import { IngredientExtras } from './IngredientExtras';
import { useCan } from '@/app/session';
import { ALLERGENS, INGREDIENT_CATEGORIES, PRICE_STALE_DAYS, STOCK_UNITS, unitInfo } from '@/lib/domain';
import { daysSince, fmtDate, fmtPct, parseNum } from '@/lib/format';
import { Button, Drawer, EmptyState, ErrorNote, Field, Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { fmtMoney } from '@/lib/format';
import { useDeleteIngredient, useIngredients, useSaveIngredient, type Ingredient } from './api';

export function IngredientsPage() {
  const { data, isLoading, error } = useIngredients();
  const canEdit = useCan(['yonetici', 'asci_basi', 'satinalma']);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const [editing, setEditing] = useState<Ingredient | 'new' | null>(null);

  const list = data ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return list.filter((i) =>
      (!cat || i.category === cat) &&
      (!needle || i.name.toLocaleLowerCase('tr').includes(needle) || (i.code ?? '').toLocaleLowerCase('tr').includes(needle)));
  }, [list, q, cat]);

  const noPrice = list.filter((i) => i.last_price === null).length;
  const stale = list.filter((i) => i.last_price !== null && (daysSince(i.price_updated_at) ?? 0) > PRICE_STALE_DAYS).length;
  const withAllergen = list.filter((i) => i.allergens.length > 0).length;
  const usedCats = Array.from(new Set(list.map((i) => i.category)));

  const report = (): ReportSpec => ({
    title: 'Stok Kartı Fiyat Listesi',
    subtitle: `${filtered.length} kalem · son alış fiyatları (KDV hariç)`,
    summary: filtered.slice(0, 30).map((i) => ({ label: i.name, value: i.last_price === null ? 'fiyat yok' : `${fmtMoney(i.last_price)} / ${i.stock_unit}` })),
    table: {
      filename: 'stok-karti-fiyatlari',
      header: ['Kod', 'Stok kartı', 'Kategori', 'Birim', 'Fire %', 'Son fiyat ₺', 'Fiyat tarihi', 'Alerjenler'],
      rows: filtered.map((i) => [i.code, i.name, INGREDIENT_CATEGORIES[i.category], i.stock_unit, i.waste_pct, i.last_price, i.price_updated_at?.slice(0, 10), i.allergens.map((a) => ALLERGENS[a]).join(', ')]),
    },
    body: () => (
      <table>
        <thead><tr><th>Stok kartı</th><th>Kategori</th><th className="num">Fire</th><th className="num">Son fiyat</th><th>Fiyat tarihi</th><th>Alerjen</th></tr></thead>
        <tbody>{filtered.map((i) => <tr key={i.id}><td>{i.name}</td><td>{INGREDIENT_CATEGORIES[i.category]}</td><td className="num">{Number(i.waste_pct) ? `%${i.waste_pct}` : '—'}</td>
          <td className="num">{i.last_price === null ? '—' : `${fmtMoney(i.last_price)}/${i.stock_unit}`}</td><td>{fmtDate(i.price_updated_at)}</td><td>{i.allergens.map((a) => ALLERGENS[a]).join(', ')}</td></tr>)}</tbody>
      </table>
    ),
  });

  return (
    <>
      <ModuleHero
        kicker="Mutfak · Stok kartları"
        title="Stok kartları"
        description="Birim, temizleme firesi, alış fiyatı ve alerjen bilgisi. Reçete maliyetleri buradaki son fiyattan anlık hesaplanır."
        actions={<>
          <ReportButton spec={report} disabled={list.length === 0} />
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Yeni stok kartı</Button>}
        </>}
        stats={[
          { label: 'Stok kartı', value: list.length },
          { label: 'Fiyatı girilmemiş', value: noPrice, tone: noPrice ? 'warn' : 'default', hint: 'Maliyete katılamaz' },
          { label: `Fiyatı ${PRICE_STALE_DAYS} günden eski`, value: stale, tone: stale ? 'warn' : 'default' },
          { label: 'Alerjen içeren', value: withAllergen },
        ]}
      />

      <Panel pad={false}>
        <div className="flex flex-col sm:flex-row gap-2.5 p-4 border-b border-line">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="tc-input pl-9" placeholder="Ad veya kod ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="tc-input sm:w-56" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            {usedCats.map((c) => <option key={c} value={c}>{INGREDIENT_CATEGORIES[c] ?? c}</option>)}
          </select>
        </div>

        {isLoading ? <Loading /> : error ? <div className="p-4"><ErrorNote>Stok kartları yüklenemedi.</ErrorNote></div>
          : list.length === 0 ? (
            <EmptyState icon={<Wheat className="w-5 h-5" />} title="Henüz stok kartı yok"
              action={canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>İlk stok kartını ekle</Button>}>
              Dana kuşbaşı, pirinç, ayçiçek yağı gibi stok kartlarını birim ve fire oranıyla ekleyin.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                    <th className="px-4 py-2.5 font-semibold">Stok kartı</th>
                    <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Kategori</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Fire</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Son fiyat</th>
                    <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Fiyat tarihi</th>
                    <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Alerjen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => {
                    const age = daysSince(i.price_updated_at);
                    return (
                      <tr key={i.id} onClick={() => setEditing(i)}
                        className={cx('border-b border-line last:border-0 cursor-pointer hover:bg-surface-2', !i.active && 'opacity-50')}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{i.name}</div>
                          <div className="text-[11px] text-ink-3">{i.code ? `${i.code} · ` : ''}Stok birimi: {i.stock_unit}</div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell text-ink-2">{INGREDIENT_CATEGORIES[i.category] ?? i.category}</td>
                        <td className="px-3 py-3 text-right tc-num text-ink-2">{Number(i.waste_pct) > 0 ? fmtPct(i.waste_pct) : '—'}</td>
                        <td className="px-3 py-3 text-right">
                          {i.last_price === null ? <Pill tone="wait">Fiyat yok</Pill>
                            : <><Money value={i.last_price} className="font-semibold text-ink" /><span className="text-ink-3 text-xs"> /{i.stock_unit}</span></>}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          {i.price_updated_at
                            ? <span className={cx('text-xs', (age ?? 0) > PRICE_STALE_DAYS ? 'text-wait font-semibold' : 'text-ink-3')}>{fmtDate(i.price_updated_at)}</span>
                            : <span className="text-ink-3">—</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {i.allergens.slice(0, 3).map((a) => <Pill key={a} tone="accent">{ALLERGENS[a] ?? a}</Pill>)}
                            {i.allergens.length > 3 && <Pill>+{i.allergens.length - 3}</Pill>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-3">Filtreye uyan stok kartı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

      {editing && (
        <IngredientDrawer ingredient={editing === 'new' ? null : editing} onClose={() => setEditing(null)} canEdit={canEdit} />
      )}
    </>
  );
}

function IngredientDrawer({ ingredient, onClose, canEdit }: { ingredient: Ingredient | null; onClose: () => void; canEdit: boolean }) {
  const toast = useToast();
  const save = useSaveIngredient();
  const del = useDeleteIngredient();
  const canPrice = useCan(['yonetici', 'satinalma', 'muhasebe']);

  const [name, setName] = useState(ingredient?.name ?? '');
  const [code, setCode] = useState(ingredient?.code ?? '');
  const [category, setCategory] = useState(ingredient?.category ?? 'diger');
  const [unit, setUnit] = useState(ingredient?.stock_unit ?? 'kg');
  const [waste, setWaste] = useState(ingredient ? String(ingredient.waste_pct).replace('.', ',') : '0');
  const [vat, setVat] = useState(ingredient ? String(ingredient.vat_rate) : '1');
  const [minStock, setMinStock] = useState(ingredient ? String(ingredient.min_stock).replace('.', ',') : '0');
  const [kcal100, setKcal100] = useState(ingredient?.kcal_100 != null ? String(ingredient.kcal_100).replace('.', ',') : '');
  const [kcalUnit, setKcalUnit] = useState(ingredient?.kcal_unit != null ? String(ingredient.kcal_unit).replace('.', ',') : '');
  const [allergens, setAllergens] = useState<string[]>(ingredient?.allergens ?? []);
  const [notes, setNotes] = useState(ingredient?.notes ?? '');
  const [active, setActive] = useState(ingredient?.active ?? true);
  const [price, setPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const readOnly = !canEdit;
  const u = unitInfo(unit);
  const wasteN = parseNum(waste);

  const submit = async () => {
    setErr(null);
    if (canEdit && !name.trim()) return setErr('Ad zorunlu.');
    if (!canEdit && !price.trim()) return setErr('Yeni fiyat girin.');
    if (canEdit && (wasteN === null || wasteN < 0 || wasteN >= 100)) return setErr('Fire oranı 0 ile 99,99 arasında olmalı.');
    const kcalA = kcal100.trim() ? parseNum(kcal100) : null;
    const kcalB = kcalUnit.trim() ? parseNum(kcalUnit) : null;
    if ((kcal100.trim() && (kcalA === null || kcalA < 0)) || (kcalUnit.trim() && (kcalB === null || kcalB < 0))) return setErr('Kalori değeri geçersiz.');
    const priceN = price.trim() ? parseNum(price) : null;
    if (price.trim() && (priceN === null || priceN < 0)) return setErr('Fiyat geçersiz.');
    if (canEdit && ingredient && unit !== ingredient.stock_unit) {
      const a = unitInfo(ingredient.stock_unit), b = unitInfo(unit);
      const msg = a.base !== b.base
        ? `Birim ${ingredient.stock_unit} → ${unit}: farklı ölçü türü. Fiyat veya stok geçmişi varsa kaydedilmez; yeni bir stok kartı açın.`
        : `Birim ${ingredient.stock_unit} → ${unit} değişecek. Son fiyat, ortalama maliyet, en az stok, fiyat geçmişi ve stok hareketleri otomatik çevrilir (1 ${ingredient.stock_unit} = ${a.toBase / b.toBase} ${unit}). Devam edilsin mi?`;
      if (!(await askConfirm(msg))) return;
    }
    try {
      await save.mutateAsync({
        id: ingredient?.id ?? null,
        draft: !canEdit ? null : {
          name: name.trim(), code: code.trim() || null, category, stock_unit: unit, waste_pct: wasteN ?? 0,
          vat_rate: parseNum(vat) ?? 1, min_stock: parseNum(minStock) ?? 0, allergens, notes: notes.trim() || null, active,
          kcal_100: kcalA, kcal_unit: kcalB,
        },
        newPrice: canPrice ? priceN : null,
        supplier,
      });
      toast.ok(ingredient ? 'Stok kartı güncellendi' : 'Stok kartı eklendi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  const remove = async () => {
    if (!ingredient || !await askConfirm(`"${ingredient.name}" silinsin mi? Reçetelerde kullanılıyorsa silinemez; pasife alın.`)) return;
    try { await del.mutateAsync(ingredient.id); toast.ok('Stok kartı silindi'); onClose(); } catch (e) { toast.error(e); }
  };

  return (
    <Drawer open onClose={onClose}
      title={ingredient ? ingredient.name : 'Yeni stok kartı'}
      subtitle={ingredient ? 'Stok kartı ve fiyat geçmişi' : 'Birim ve fire doğru girilirse reçete maliyeti doğru çıkar'}
      footer={(canEdit || (canPrice && ingredient)) && (
        <>
          {ingredient && canEdit && <Button variant="danger" className="mr-auto" icon={<Trash2 className="w-4 h-4" />} onClick={remove} loading={del.isPending}>Sil</Button>}
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="holo" onClick={submit} loading={save.isPending}>{canEdit ? 'Kaydet' : 'Fiyatı kaydet'}</Button>
        </>
      )}>
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ad" className="col-span-2"><input className="tc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dana kuşbaşı" /></Field>
          <Field label="Kod"><input className="tc-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="HM-001" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <select className="tc-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(INGREDIENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Stok birimi" hint={`Reçetede ${u.base} ile girilir`}>
            <select className="tc-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {STOCK_UNITS.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Temizleme firesi %" hint={wasteN !== null && wasteN > 0 && wasteN < 100 ? `1 ${u.base} net → ${(1 / (1 - wasteN / 100)).toFixed(3).replace('.', ',')} ${u.base} brüt` : 'Ayıklama/kemik/kabuk kaybı'}>
            <input className="tc-input tc-num" inputMode="decimal" value={waste} onChange={(e) => setWaste(e.target.value)} />
          </Field>
          <Field label="KDV %"><input className="tc-input tc-num" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} /></Field>
          <Field label={`Min. stok (${unit})`}><input className="tc-input tc-num" inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {u.base === 'adet'
            ? <Field label="Enerji (kcal / 1 adet)" hint="Menü kartı kalori hesabı için"><input className="tc-input tc-num" inputMode="decimal" value={kcalUnit} onChange={(e) => setKcalUnit(e.target.value)} placeholder="ör. 75" /></Field>
            : <Field label={`Enerji (kcal / 100 ${u.base === 'ml' ? 'ml' : 'g'})`} hint="Ambalaj etiketindeki değer; menü kartı kalori hesabı için"><input className="tc-input tc-num" inputMode="decimal" value={kcal100} onChange={(e) => setKcal100(e.target.value)} placeholder="ör. 250" /></Field>}
        </div>

        <Field label="Alerjenler">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ALLERGENS).map(([k, v]) => {
              const on = allergens.includes(k);
              return (
                <button key={k} type="button"
                  onClick={() => setAllergens(on ? allergens.filter((a) => a !== k) : [...allergens, k])}
                  className={cx('px-2.5 py-1 rounded-full text-xs font-medium ring-1 transition',
                    on ? 'bg-accent-soft text-accent-strong ring-accent' : 'bg-card text-ink-3 ring-line hover:text-ink')}>
                  {v}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Not"><textarea className="tc-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--tc-brand)]" /> Aktif
        </label>
      </fieldset>

      <div className="mt-6 rounded-2xl bg-card ring-1 ring-line p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-ink">Alış fiyatı</h4>
          {ingredient?.last_price != null && (
            <span className="text-sm">Güncel: <Money value={ingredient.last_price} className="font-bold text-ink" /> / {ingredient.stock_unit}</span>
          )}
        </div>
        {canPrice ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Yeni fiyat (₺ / ${unit}, KDV hariç)`}>
              <input className="tc-input tc-num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Tedarikçi (ops.)"><input className="tc-input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Kasap / toptancı" /></Field>
          </div>
        ) : (
          <p className="text-xs text-ink-3">Fiyat girişi satınalma, muhasebe ve yönetici rollerine açıktır.</p>
        )}
      </div>

      {ingredient && <IngredientExtras ingredient={ingredient} />}

      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
      {readOnly && (
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-3"><AlertTriangle className="w-3.5 h-3.5" /> Bu kartı düzenleme yetkiniz yok.</div>
      )}
    </Drawer>
  );
}
