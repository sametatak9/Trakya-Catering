import { useState } from 'react';
import { Plus, Trash2, Trophy } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { shortDay } from '@/lib/dates';
import { fmtNum, parseNum } from '@/lib/format';
import { normTr } from '@/lib/normTr';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Loading, Money, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import type { Ingredient } from './api';

/**
 * Stok kartı alt sekmeleri (Faz 3E): tedarikçi/fatura adları (takma ad), koli birimleri, teklifler,
 * fiyat geçmişi (tarih · fiyat · tedarikçi · belge) ve verim (brüt → net) testi.
 */
export function IngredientExtras({ ingredient }: { ingredient: Ingredient }) {
  const [tab, setTab] = useState<'adlar' | 'fiyat' | 'teklif' | 'verim'>('adlar');
  return (
    <div className="mt-6 rounded-2xl bg-card ring-1 ring-line p-4">
      <Tabs value={tab} onChange={setTab} items={[{ id: 'adlar', label: 'Tedarikçi adları' }, { id: 'fiyat', label: 'Fiyat geçmişi' }, { id: 'teklif', label: 'Teklifler' }, { id: 'verim', label: 'Verim' }]} />
      <div className="mt-3">
        {tab === 'adlar' && <Aliases ingredient={ingredient} />}
        {tab === 'fiyat' && <PriceHistory ingredient={ingredient} />}
        {tab === 'teklif' && <Quotes ingredient={ingredient} />}
        {tab === 'verim' && <Yield ingredient={ingredient} />}
      </div>
    </div>
  );
}

function useSupplierName() {
  const suppliers = useRows('suppliers', { order: 'name' });
  return { list: suppliers.data ?? [], name: (id: string | null) => (id ? (suppliers.data ?? []).find((s) => s.id === id)?.name ?? '—' : 'Genel') };
}

function Aliases({ ingredient }: { ingredient: Ingredient }) {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'satinalma', 'muhasebe']);
  const sup = useSupplierName();
  const rows = useRows('ingredient_aliases', { key: [ingredient.id], order: 'alias_raw', filter: (q) => q.eq('ingredient_id', ingredient.id) });
  const packs = useRows('ingredient_pack_units', { key: [ingredient.id], order: 'pack_name', filter: (q) => q.eq('ingredient_id', ingredient.id) });
  const del = useDeleteRow('ingredient_aliases');
  const [raw, setRaw] = useState('');
  const [supplier, setSupplier] = useState('');
  const [code, setCode] = useState('');
  const add = async () => {
    if (!normTr(raw)) return toast.error('Faturada geçen adı yazın');
    try {
      unwrap(await supabase.rpc('confirm_alias', { p_ingredient: ingredient.id, p_supplier: (supplier || null) as string, p_raw: raw.trim(), p_seller_code: code.trim() || undefined }));
      setRaw(''); setCode(''); await rows.refetch();
      toast.ok('Ad kaydedildi; faturalarda otomatik eşleşir');
    } catch (e) { toast.error(e); }
  };
  if (rows.isLoading) return <Loading />;
  const list = rows.data ?? [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-3">Tedarikçinin faturasında bu ürün hangi adla geçiyorsa buraya yazılır; bir sonraki faturada otomatik eşleşir. Kanonik ad (kartın adı) değişmez.</p>
      {list.length === 0 ? <p className="text-xs text-ink-3">Kayıtlı ad yok.</p> : (
        <ul className="divide-y divide-line text-sm">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-ink">{a.alias_raw}</span>
              {a.seller_item_code && <span className="text-[11px] text-ink-3">kod {a.seller_item_code}</span>}
              <span className={cx('text-[11px] rounded-full px-2 py-0.5', a.supplier_id ? 'bg-info-soft text-info' : 'bg-surface-2 text-ink-3')}>{sup.name(a.supplier_id)}</span>
              {canEdit && <button type="button" className="text-ink-3 hover:text-stop" aria-label="Adı kaldır" onClick={() => del.mutate({ id: a.id }, { onSuccess: () => rows.refetch(), onError: toast.error })}><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_6rem_auto] gap-2">
          <input className="tc-input" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Faturadaki ad, ör. DANA KUŞBAŞI 1.SINIF" aria-label="Faturadaki ad" />
          <select className="tc-input" value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Tedarikçi">
            <option value="">Genel (tüm tedarikçiler)</option>
            {sup.list.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="tc-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ürün kodu" aria-label="Satıcı ürün kodu" />
          <Button icon={<Plus className="h-4 w-4" />} onClick={add}>Ekle</Button>
        </div>
      )}
      {(packs.data ?? []).length > 0 && (
        <div className="text-xs text-ink-2">
          <span className="font-semibold text-ink-3">Ambalaj birimleri: </span>
          {(packs.data ?? []).map((p) => `1 ${p.pack_name} = ${fmtNum(Number(p.factor_to_stock), 3)} ${ingredient.stock_unit}`).join(' · ')}
        </div>
      )}
    </div>
  );
}

function PriceHistory({ ingredient }: { ingredient: Ingredient }) {
  const sup = useSupplierName();
  const prices = useRows('ingredient_prices', { key: ['gecmis', ingredient.id], order: 'noted_at', ascending: false, filter: (q) => q.eq('ingredient_id', ingredient.id).limit(60) });
  const invoices = useRows('purchase_invoices', { key: ['fiyat-belge', ingredient.id], enabled: (prices.data ?? []).some((p) => p.purchase_invoice_id),
    filter: (q) => q.in('id', [...new Set((prices.data ?? []).map((p) => p.purchase_invoice_id).filter(Boolean) as string[])]) });
  if (prices.isLoading) return <Loading />;
  const list = prices.data ?? [];
  if (list.length === 0) return <p className="text-xs text-ink-3">Henüz fiyat girilmemiş.</p>;
  return (
    <div className="overflow-x-auto tc-scroll">
      <table className="w-full text-sm min-w-[480px]">
        <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
          <th className="py-1.5">Tarih</th><th className="py-1.5 text-right">Fiyat</th><th className="py-1.5 pl-3">Tedarikçi</th><th className="py-1.5">Belge</th></tr></thead>
        <tbody>{list.map((p, i) => {
          const prev = list[i + 1]; const ch = prev ? (Number(p.price) - Number(prev.price)) / Number(prev.price) : 0;
          const inv = (invoices.data ?? []).find((x) => x.id === p.purchase_invoice_id);
          return (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="py-1.5 text-ink-2">{shortDay(p.noted_at.slice(0, 10))}</td>
              <td className="py-1.5 text-right"><Money value={p.price} precise className="font-semibold" />
                {prev && Math.abs(ch) > 0.03 && <span className={cx('ml-1 text-[10px]', ch > 0 ? 'text-stop' : 'text-ok')}>{ch > 0 ? '▲' : '▼'}{Math.round(Math.abs(ch) * 100)}%</span>}</td>
              <td className="py-1.5 pl-3 text-ink-2">{p.supplier_id ? sup.name(p.supplier_id) : p.supplier_name ?? '—'}</td>
              <td className="py-1.5 text-[11px] text-ink-3">{inv ? `Fatura ${inv.invoice_no}` : p.source === 'alis_faturasi' ? 'Fatura' : 'Elle'}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function Quotes({ ingredient }: { ingredient: Ingredient }) {
  const sup = useSupplierName();
  const quotes = useRows('supplier_quotes', { key: ['kart', ingredient.id], order: 'price', filter: (q) => q.eq('ingredient_id', ingredient.id).limit(30) });
  if (quotes.isLoading) return <Loading />;
  const list = quotes.data ?? [];
  if (list.length === 0) return <p className="text-xs text-ink-3">Teklif yok. Satınalma › “Teklif / fiyat kaydı” ile girilir; en uygun olan kupayla işaretlenir.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {list.map((x, i) => (
        <li key={x.id} className="flex items-center gap-2 py-1.5">
          {i === 0 ? <Trophy className="h-3.5 w-3.5 text-accent-strong" /> : <span className="w-3.5" />}
          <span className="flex-1 text-ink">{sup.name(x.supplier_id)}</span>
          <span className="text-[11px] text-ink-3">{shortDay(x.quoted_at)}</span>
          <Money value={x.price} precise className={cx(i === 0 && 'font-bold')} />
        </li>
      ))}
    </ul>
  );
}

function Yield({ ingredient }: { ingredient: Ingredient }) {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'satinalma', 'asci_basi']);
  const sup = useSupplierName();
  const tests = useRows('yield_tests', { key: [ingredient.id], order: 'test_date', ascending: false, filter: (q) => q.eq('ingredient_id', ingredient.id) });
  const save = useSaveRow('yield_tests');
  const [f, setF] = useState({ supplier: '', gross: '', net: '' });
  const add = async () => {
    const g = parseNum(f.gross), n = parseNum(f.net);
    if (!g || !n || n > g) return toast.error('Brüt ve net miktarı girin (net ≤ brüt)');
    try {
      await save.mutateAsync({ row: { ingredient_id: ingredient.id, supplier_id: f.supplier || null, gross_qty: g, net_qty: n } });
      setF({ supplier: f.supplier, gross: '', net: '' }); await tests.refetch(); toast.ok('Verim testi kaydedildi');
    } catch (e) { toast.error(e); }
  };
  const list = tests.data ?? [];
  const bySup = new Map<string, number[]>();
  for (const t of list) bySup.set(t.supplier_id ?? '', [...(bySup.get(t.supplier_id ?? '') ?? []), Number(t.yield_pct)]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-3">Kasap/ayıklama testi: alınan brüt miktardan temizlendikten sonra kalan net. Teklif karşılaştırmasında gerçek maliyet = fiyat ÷ verim.</p>
      {bySup.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...bySup.entries()].map(([s, v]) => {
            const avg = v.reduce((a, b) => a + b, 0) / v.length;
            const real = ingredient.last_price ? Number(ingredient.last_price) / (avg / 100) : null;
            return <span key={s} className="rounded-lg ring-1 ring-line px-2 py-1 text-xs">{sup.name(s || null)} · verim %{fmtNum(avg, 1)}{real ? <> · net maliyet <Money value={real} precise /></> : ''}</span>;
          })}
        </div>
      )}
      {list.length > 0 && <ul className="text-xs text-ink-2 space-y-0.5">{list.slice(0, 8).map((t) => <li key={t.id}>{shortDay(t.test_date)} · {sup.name(t.supplier_id)} · {fmtNum(Number(t.gross_qty), 2)} → {fmtNum(Number(t.net_qty), 2)} {ingredient.stock_unit} (%{fmtNum(Number(t.yield_pct), 1)})</li>)}</ul>}
      {canEdit && (
        <div className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2">
          <select className="tc-input" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} aria-label="Tedarikçi">
            <option value="">Tedarikçi seç…</option>
            {sup.list.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="tc-input tc-num" inputMode="decimal" value={f.gross} onChange={(e) => setF({ ...f, gross: e.target.value })} placeholder={`Brüt ${ingredient.stock_unit}`} aria-label="Brüt" />
          <input className="tc-input tc-num" inputMode="decimal" value={f.net} onChange={(e) => setF({ ...f, net: e.target.value })} placeholder={`Net ${ingredient.stock_unit}`} aria-label="Net" />
          <Button icon={<Plus className="h-4 w-4" />} onClick={add} loading={save.isPending} aria-label="Verim testi ekle" />
        </div>
      )}
    </div>
  );
}
