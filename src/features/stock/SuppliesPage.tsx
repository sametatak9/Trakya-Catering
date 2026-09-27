import { useMemo, useState } from 'react';
import { PackageOpen, Plus } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { monthKey, monthLabel, monthRange, shortDay, todayISO } from '@/lib/dates';
import { fmtMoney, fmtNum } from '@/lib/format';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { MonthNav } from '@/ui/bits';
import { askConfirm } from '@/ui/confirm';
import { FormDrawer } from '@/ui/FormDrawer';
import { EmptyState, Loading, ModuleHero, Money, Panel, Button } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useIngredients } from '../kitchen/api';
import { useCustomers } from '../sales/api';

/** Firmalara giden malzeme (tuz, baharat, ketçap, mayonez, yağ…): stoktan düşer, o firmanın maliyetine yazılır. */
export function SuppliesPage() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'depo', 'sofor', 'asci_basi', 'satinalma']);
  const canDelete = useCan(['yonetici']);
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const { from, to } = monthRange(month);
  const moves = useRows('stock_movements', { key: ['sevk', from, to], order: 'move_date', ascending: false, filter: (q) => q.eq('source', 'sevk').gte('move_date', from).lte('move_date', to) });
  const ingredients = useIngredients();
  const customers = useCustomers();
  const save = useSaveRow('stock_movements', ['ingredients']);
  const del = useDeleteRow('stock_movements');
  const [adding, setAdding] = useState(false);

  const ings = (ingredients.data ?? []).filter((i) => i.active);
  const ing = (id: string) => ings.find((i) => i.id === id);
  const custName = (id: string | null) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '—';
  const list = moves.data ?? [];
  // Ters kayıt, geri aldığı gönderimin birim maliyetiyle düşülür
  const origOf = (m: (typeof list)[number]) => (m.note?.startsWith('Ters kayıt: ') ? list.find((x) => x.id === m.note!.slice(12)) : undefined);
  const costOf = (m: (typeof list)[number]) => -Number(m.qty) * Number(m.unit_cost ?? origOf(m)?.unit_cost ?? ing(m.ingredient_id)?.avg_cost ?? ing(m.ingredient_id)?.last_price ?? 0);
  const total = list.reduce((s, m) => s + costOf(m), 0);
  const byCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of list) map.set(m.customer_id ?? '', (map.get(m.customer_id ?? '') ?? 0) + costOf(m));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, ings]);
  const byItem = useMemo(() => {
    const map = new Map<string, { qty: number; cost: number }>();
    for (const m of list) { const x = map.get(m.ingredient_id) ?? { qty: 0, cost: 0 }; x.qty += -Number(m.qty); x.cost += costOf(m); map.set(m.ingredient_id, x); }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, ings]);

  const report = (): ReportSpec => ({
    title: 'Firmalara Giden Malzeme', subtitle: `${monthLabel(month)} · toplam ${fmtMoney(total)}`,
    summary: byCustomer.map(([c, v]) => ({ label: custName(c), value: fmtMoney(v) })),
    table: { filename: `sevk-${month}`, header: ['Tarih', 'Firma', 'Malzeme', 'Miktar', 'Birim', 'Tutar ₺', 'Not'],
      rows: list.map((m) => [m.move_date, custName(m.customer_id), ing(m.ingredient_id)?.name, -Number(m.qty), ing(m.ingredient_id)?.stock_unit, Math.round(costOf(m) * 100) / 100, m.note]) },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Toplam maliyet', value: fmtMoney(total) }, { label: 'Firma', value: byCustomer.length }, { label: 'Kalem', value: list.length }]} />
        <ReportSection title="Firma bazında">
          <table><thead><tr><th>Firma</th><th className="num">Tutar</th></tr></thead>
            <tbody>{byCustomer.map(([c, v]) => <tr key={c}><td>{custName(c)}</td><td className="num">{fmtMoney(v)}</td></tr>)}</tbody></table>
        </ReportSection>
        <ReportSection title="Hareketler">
          <table><thead><tr><th>Tarih</th><th>Firma</th><th>Malzeme</th><th className="num">Miktar</th><th className="num">Tutar</th></tr></thead>
            <tbody>{list.map((m) => <tr key={m.id}><td>{shortDay(m.move_date)}</td><td>{custName(m.customer_id)}</td><td>{ing(m.ingredient_id)?.name}</td>
              <td className="num">{fmtNum(-Number(m.qty), 2)} {ing(m.ingredient_id)?.stock_unit}</td><td className="num">{fmtMoney(costOf(m))}</td></tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Depo · Sevk" title="Firmalara Giden Malzeme"
        description="Yemekle birlikte firmaya bırakılan tuz, baharat, ketçap, mayonez, yağ, peçete… Stoktan seçilir, depodan düşer ve o firmanın maliyetine yazılır."
        actions={<>
          <ReportButton spec={report} disabled={list.length === 0} />
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>Malzeme gönder</Button>}
        </>}
        stats={[
          { label: `${monthLabel(month)} toplam`, value: <Money value={total} />, source: report },
          { label: 'Firma', value: byCustomer.length },
          { label: 'En çok giden', value: byItem[0] ? ing(byItem[0][0])?.name ?? '—' : '—' },
          { label: 'Kalem', value: list.length },
        ]} />
      <div className="mb-4"><MonthNav value={month} onChange={setMonth} /></div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Panel pad={false} title="Gönderilenler">
          {moves.isLoading ? <Loading /> : list.length === 0 ? (
            <EmptyState icon={<PackageOpen className="w-5 h-5" />} title="Bu ay gönderim yok">Önce Stok kartları ekranına tuz, ketçap gibi sarf malzemelerini ekleyin; sonra buradan firmaya gönderin.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {list.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-14 text-xs text-ink-3 tc-num">{shortDay(m.move_date)}</span>
                  <span className="flex-1 min-w-0"><span className="font-semibold text-ink">{ing(m.ingredient_id)?.name}</span><span className="block text-[11px] text-ink-3 truncate">{custName(m.customer_id)}{m.note ? ` · ${m.note}` : ''}</span></span>
                  <span className="tc-num text-sm">{fmtNum(-Number(m.qty), 2)} {ing(m.ingredient_id)?.stock_unit}</span>
                  <Money value={costOf(m)} className="font-semibold w-24 text-right" />
                  {m.kind !== 'sevk' ? <span className="text-[11px] text-ink-3">ters kayıt</span>
                    : canDelete ? <button type="button" className="text-xs text-ink-3 hover:text-stop" onClick={async () => {
                      if (!(await askConfirm('Gönderim silinsin mi? Stok geri eklenir.'))) return;
                      try { await del.mutateAsync({ id: m.id }); toast.ok('Silindi'); } catch (e) { toast.error(e); }
                    }}>sil</button>
                    : canEdit && !list.some((x) => x.kind !== 'sevk' && x.note === `Ters kayıt: ${m.id}`) && <button type="button" className="text-xs text-ink-3 hover:text-ink" title="Hatalı gönderimi geri alır; kayıt silinmez" onClick={async () => {
                      if (!(await askConfirm('Bu gönderim ters kayıtla geri alınsın mı? Stok geri eklenir, firmanın maliyetinden düşer.'))) return;
                      try {
                        await save.mutateAsync({ row: { ingredient_id: m.ingredient_id, customer_id: m.customer_id, move_date: todayISO(), kind: 'giris', qty: -Number(m.qty), unit_cost: null, source: 'sevk', note: `Ters kayıt: ${m.id}` } });
                        toast.ok('Ters kayıt işlendi');
                      } catch (e) { toast.error(e); }
                    }}>geri al</button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Firma bazında maliyet" subtitle="Kişi başı maliyete eklenecek yan gider">
          {byCustomer.length === 0 ? <p className="text-sm text-ink-3">—</p> : (
            <ul className="space-y-2">{byCustomer.map(([c, v]) => <li key={c} className="flex justify-between gap-2 text-sm"><span className="truncate text-ink-2">{custName(c)}</span><Money value={v} className="font-semibold" /></li>)}</ul>
          )}
        </Panel>
      </div>

      {adding && (
        <FormDrawer open title="Firmaya malzeme gönder" subtitle="Stoktan düşer, firmanın maliyetine yazılır" onClose={() => setAdding(false)} saving={save.isPending}
          fields={[
            { key: 'customer_id', label: 'Firma', type: 'select', required: true, span: 2, options: (customers.data ?? []).filter((c) => c.active).map((c) => ({ value: c.id, label: c.name })) },
            { key: 'ingredient_id', label: 'Malzeme (stoktan)', type: 'select', required: true, span: 2, options: ings.map((i) => ({ value: i.id, label: `${i.name} (${i.stock_unit})` })) },
            { key: 'qty', label: 'Miktar (stok biriminde)', type: 'number', required: true },
            { key: 'move_date', label: 'Tarih', type: 'date', required: true },
            { key: 'note', label: 'Not', span: 2, placeholder: 'ör. 20 tuzluk + 2 koli peçete' },
          ]}
          initial={{ move_date: todayISO() }}
          onSave={async (v) => {
            const qty = Math.abs(Number(v.qty));
            if (!(qty > 0)) throw new Error('Miktar sıfırdan büyük olmalı');
            const i = ing(String(v.ingredient_id));
            await save.mutateAsync({ row: { ...v, kind: 'sevk', qty: -qty, source: 'sevk', unit_cost: i?.avg_cost ?? i?.last_price ?? null } });
            toast.ok('Gönderim kaydedildi'); setAdding(false);
          }} />
      )}
    </>
  );
}
