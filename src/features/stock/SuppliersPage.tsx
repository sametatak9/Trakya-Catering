import { useState } from 'react';
import { Handshake, Plus, Star } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { shortDay } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { FormDrawer, type FieldDef } from '@/ui/FormDrawer';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { Button, EmptyState, Loading, ModuleHero, Money, Panel, Pill } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useOpenItems } from '../finance/api';

type Supplier = NonNullable<ReturnType<typeof useRows<'suppliers'>>['data']>[number];

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Unvan', required: true, span: 2 },
  { key: 'tax_no', label: 'VKN / TCKN' },
  { key: 'city', label: 'İl / ilçe' },
  { key: 'contact_name', label: 'Yetkili' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'email', label: 'E-posta', type: 'email' },
  { key: 'payment_term_days', label: 'Ödeme vadesi (gün)', type: 'number' },
  { key: 'categories', label: 'Ne satıyor', type: 'tags', span: 2, placeholder: 'et, tavuk, sebze, kuru gıda…' },
  { key: 'rating', label: 'Puan (1–5)', type: 'select', options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: '★'.repeat(n) })) },
  { key: 'active', label: 'Çalışıyoruz', type: 'checkbox' },
  { key: 'notes', label: 'Not', type: 'textarea' },
];

export function SuppliersPage() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'satinalma', 'muhasebe']);
  const canFinance = useCan(['yonetici', 'muhasebe']);
  const suppliers = useRows('suppliers', { order: 'name' });
  const quotes = useRows('supplier_quotes', { key: ['all'], order: 'quoted_at', ascending: false });
  const open = useOpenItems(canFinance);
  const save = useSaveRow('suppliers');
  const del = useDeleteRow('suppliers');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);

  const list = (suppliers.data ?? []).filter((s) => matches(q, s.name, s.tax_no, s.city, ...(s.categories ?? [])));
  // Cari borç: onaylı faturadan gelen ödenmemiş gider, tedarikçi adıyla eşleşir
  const debtOf = (name: string) => (open.data ?? []).filter((e) => e.kind === 'gider' && (e.counterparty ?? '').toLocaleLowerCase('tr').startsWith(name.toLocaleLowerCase('tr').slice(0, 12)))
    .reduce((s, e) => s + Number(e.net_amount) + Number(e.vat_amount), 0);
  const quoteCount = (id: string) => (quotes.data ?? []).filter((x) => x.supplier_id === id).length;
  const lastQuote = (id: string) => (quotes.data ?? []).find((x) => x.supplier_id === id)?.quoted_at;
  const totalDebt = list.reduce((s, x) => s + debtOf(x.name), 0);

  const report = (): ReportSpec => ({
    title: 'Tedarikçi Listesi', subtitle: `${list.length} tedarikçi${canFinance ? ` · açık borç ${fmtMoney(totalDebt)}` : ''}`,
    summary: list.map((s) => ({ label: s.name, value: `${s.phone ?? ''}${canFinance ? ` · borç ${fmtMoney(debtOf(s.name))}` : ''}` })),
    table: { filename: 'tedarikciler', header: ['Unvan', 'VKN', 'İl', 'Yetkili', 'Telefon', 'Ne satıyor', 'Vade', 'Fiyat kaydı', 'Açık borç ₺'],
      rows: list.map((s) => [s.name, s.tax_no, s.city, s.contact_name, s.phone, (s.categories ?? []).join(', '), s.payment_term_days, quoteCount(s.id), canFinance ? debtOf(s.name) : '']) },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Tedarikçi', value: list.length }, ...(canFinance ? [{ label: 'Açık borç', value: fmtMoney(totalDebt) }] : [])]} />
        <ReportSection title="Tedarikçiler">
          <table><thead><tr><th>Unvan</th><th>Yetkili / telefon</th><th>Ne satıyor</th><th className="num">Vade</th>{canFinance && <th className="num">Borç</th>}</tr></thead>
            <tbody>{list.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.contact_name ?? ''} {s.phone ?? ''}</td><td>{(s.categories ?? []).join(', ')}</td><td className="num">{s.payment_term_days} gün</td>
              {canFinance && <td className="num">{fmtMoney(debtOf(s.name))}</td>}</tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Depo · Tedarik ağı" title="Tedarikçiler"
        description="Mal aldığınız firmalar: ne sattıkları, vade, puan, verdikleri fiyatların kaydı ve açık borcunuz. En uygun fiyat Satınalma ekranında karşılaştırılır."
        actions={<>
          <ReportButton spec={report} disabled={list.length === 0} />
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Yeni tedarikçi</Button>}
        </>}
        stats={[
          { label: 'Tedarikçi', value: (suppliers.data ?? []).filter((s) => s.active).length, source: report },
          { label: 'Fiyat kaydı', value: (quotes.data ?? []).length },
          ...(canFinance ? [{ label: 'Açık borç (fatura)', value: <Money value={totalDebt} />, source: report }] : []),
        ]} />

      <Panel pad={false}>
        <ListToolbar search={q} onSearch={setQ} placeholder="Unvan, VKN, ürün…" />
        {suppliers.isLoading ? <Loading /> : list.length === 0 ? (
          <EmptyState icon={<Handshake className="w-5 h-5" />} title="Tedarikçi yok" action={canEdit && <Button variant="primary" onClick={() => setEditing('new')}>Tedarikçi ekle</Button>}>Kasap, manav, toptancı, ambalajcı…</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setEditing(s)} className="w-full text-left flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-ink truncate">{s.name} {!s.active && <Pill>pasif</Pill>}</span>
                    <span className="block text-xs text-ink-3 truncate">{[s.city, s.contact_name, s.phone].filter(Boolean).join(' · ')}{(s.categories ?? []).length ? ` · ${(s.categories ?? []).join(', ')}` : ''}</span>
                  </span>
                  {s.rating && <span className="inline-flex items-center gap-0.5 text-accent-strong text-xs">{Array.from({ length: s.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}</span>}
                  <span className="text-xs text-ink-3">{quoteCount(s.id)} fiyat{lastQuote(s.id) ? ` · son ${shortDay(lastQuote(s.id)!)}` : ''}</span>
                  {canFinance && <Money value={debtOf(s.name)} className="font-semibold w-28 text-right" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && (
        <FormDrawer open title={editing === 'new' ? 'Yeni tedarikçi' : editing.name} fields={FIELDS} readOnly={!canEdit}
          initial={editing === 'new' ? { active: true, payment_term_days: 30 } : { ...editing, rating: editing.rating ? String(editing.rating) : '' }}
          onClose={() => setEditing(null)} saving={save.isPending} deleting={del.isPending} deleteLabel="Tedarikçi"
          onSave={async (v) => {
            await save.mutateAsync({ id: editing === 'new' ? null : editing.id, row: { ...v, rating: v.rating ? Number(v.rating) : null, payment_term_days: v.payment_term_days ?? 30 } });
            toast.ok('Tedarikçi kaydedildi'); setEditing(null);
          }}
          onDelete={editing !== 'new' ? async () => { await del.mutateAsync({ id: editing.id }); toast.ok('Silindi'); setEditing(null); } : undefined} />
      )}
    </>
  );
}
