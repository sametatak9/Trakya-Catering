import { useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { useCan } from '@/app/session';
import { monthRange, todayISO, monthKey } from '@/lib/dates';
import { ROLES } from '@/lib/domain';
import { fmtNum, parseNum } from '@/lib/format';
import { Button, Drawer, EmptyState, ErrorNote, Field, Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { fmtMoney } from '@/lib/format';
import { orderPeople, useCustomers, useOrders, useSaveCustomer, type Customer } from './api';

export function CustomersPage() {
  const customers = useCustomers();
  const canEdit = useCan(ROLES.customersWrite);
  const month = monthKey(todayISO());
  const { from, to } = monthRange(month);
  const orders = useOrders(from, to);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);

  const list = customers.data ?? [];
  const peopleBy = useMemo(() => {
    const m = new Map<string, { people: number; amount: number }>();
    for (const o of orders.data ?? []) {
      if (o.status === 'iptal') continue;
      const cur = m.get(o.customer_id) ?? { people: 0, amount: 0 };
      cur.people += orderPeople(o); cur.amount += orderPeople(o) * Number(o.unit_price);
      m.set(o.customer_id, cur);
    }
    return m;
  }, [orders.data]);
  const filtered = list.filter((c) => !q.trim() || c.name.toLocaleLowerCase('tr').includes(q.trim().toLocaleLowerCase('tr')));
  const monthPeople = [...peopleBy.values()].reduce((s, x) => s + x.people, 0);
  const monthAmount = [...peopleBy.values()].reduce((s, x) => s + x.amount, 0);

  const report = (): ReportSpec => ({
    title: 'Müşteri Listesi',
    subtitle: `Bu ay · ${fmtNum(monthPeople, 0)} kişi · ${fmtMoney(monthAmount)}`,
    summary: filtered.map((c) => ({ label: c.name, value: `${fmtNum(peopleBy.get(c.id)?.people ?? 0, 0)} kişi · ${fmtMoney(peopleBy.get(c.id)?.amount ?? 0)}` })),
    table: {
      filename: 'musteriler',
      header: ['Firma', 'VKN/TCKN', 'Vergi dairesi', 'İl', 'İlçe', 'Yetkili', 'Telefon', 'Kişi başı ₺', 'KDV %', 'Vade', 'Bu ay kişi', 'Bu ay tutar ₺'],
      rows: filtered.map((c) => [c.name, c.tax_no, c.tax_office, c.city, c.district, c.contact_name, c.phone, c.default_meal_price, c.vat_rate, c.payment_term_days,
        peopleBy.get(c.id)?.people ?? 0, peopleBy.get(c.id)?.amount ?? 0]),
    },
    body: () => (
      <table>
        <thead><tr><th>Firma</th><th>Yetkili</th><th className="num">Kişi başı</th><th className="num">Vade</th><th className="num">Bu ay kişi</th><th className="num">Bu ay tutar</th></tr></thead>
        <tbody>{filtered.map((c) => <tr key={c.id}><td>{c.name}<div style={{ color: '#857B6D' }}>{[c.district, c.city].filter(Boolean).join(' / ')}</div></td>
          <td>{c.contact_name}<div style={{ color: '#857B6D' }}>{c.phone}</div></td><td className="num">{fmtMoney(c.default_meal_price)}</td><td className="num">{c.payment_term_days} gün</td>
          <td className="num">{fmtNum(peopleBy.get(c.id)?.people ?? 0, 0)}</td><td className="num">{fmtMoney(peopleBy.get(c.id)?.amount ?? 0)}</td></tr>)}</tbody>
      </table>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Satış · Cari kartlar" title="Müşteriler"
        description="Yemek verilen firmalar: kişi başı fiyat, KDV, ödeme vadesi ve fatura bilgileri. Siparişte fiyat buradan otomatik gelir."
        actions={<>
          <ReportButton spec={report} disabled={list.length === 0} />
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Yeni müşteri</Button>}
        </>}
        stats={[
          { label: 'Aktif müşteri', value: list.filter((c) => c.active).length },
          { label: 'Bu ay kişi', value: fmtNum(monthPeople, 0) },
          { label: 'Bu ay tutar (KDV hariç)', value: <Money value={monthAmount} /> },
          { label: 'Ort. kişi başı', value: monthPeople ? <Money value={monthAmount / monthPeople} /> : '—' },
        ]} />

      <Panel pad={false}>
        <div className="p-4 border-b border-line">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="tc-input pl-9" placeholder="Firma ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {customers.isLoading ? <Loading /> : customers.error ? <div className="p-4"><ErrorNote>Müşteriler yüklenemedi.</ErrorNote></div>
          : list.length === 0 ? (
            <EmptyState icon={<Building2 className="w-5 h-5" />} title="Henüz müşteri yok"
              action={canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>İlk müşteriyi ekle</Button>}>
              Fabrika, şantiye veya ofis — yemek verdiğiniz her kurum bir müşteri kartıdır.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                    <th className="px-4 py-2.5 font-semibold">Firma</th>
                    <th className="px-3 py-2.5 font-semibold hidden md:table-cell">İletişim</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Kişi başı</th>
                    <th className="px-3 py-2.5 font-semibold text-right hidden sm:table-cell">Vade</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Bu ay kişi</th>
                    <th className="px-4 py-2.5 font-semibold text-right hidden lg:table-cell">Bu ay tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const s = peopleBy.get(c.id);
                    return (
                      <tr key={c.id} onClick={() => setEditing(c)} className={cx('border-b border-line last:border-0 cursor-pointer hover:bg-surface-2', !c.active && 'opacity-50')}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink flex items-center gap-2">{c.name}{c.e_invoice && <Pill tone="info">e-Fatura</Pill>}</div>
                          <div className="text-[11px] text-ink-3">{[c.district, c.city].filter(Boolean).join(' / ') || (c.tax_no ? `VKN ${c.tax_no}` : '')}</div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell text-ink-2">{c.contact_name ?? '—'}<div className="text-[11px] text-ink-3">{c.phone}</div></td>
                        <td className="px-3 py-3 text-right"><Money value={c.default_meal_price} className="font-semibold text-ink" /></td>
                        <td className="px-3 py-3 text-right hidden sm:table-cell text-ink-2 tc-num">{c.payment_term_days} gün</td>
                        <td className="px-3 py-3 text-right tc-num text-ink">{fmtNum(s?.people ?? 0, 0)}</td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell"><Money value={s?.amount ?? 0} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
      {editing && <CustomerDrawer customer={editing === 'new' ? null : editing} canEdit={canEdit} onClose={() => setEditing(null)} />}
    </>
  );
}

function CustomerDrawer({ customer, canEdit, onClose }: { customer: Customer | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveCustomer();
  const c = customer;
  const [f, setF] = useState({
    name: c?.name ?? '', kind: c?.kind ?? 'kurum', tax_no: c?.tax_no ?? '', tax_office: c?.tax_office ?? '',
    address: c?.address ?? '', city: c?.city ?? '', district: c?.district ?? '', contact_name: c?.contact_name ?? '',
    phone: c?.phone ?? '', email: c?.email ?? '', price: c?.default_meal_price != null ? String(c.default_meal_price).replace('.', ',') : '',
    vat: String(c?.vat_rate ?? 10), term: String(c?.payment_term_days ?? 30), e_invoice: c?.e_invoice ?? false, notes: c?.notes ?? '', active: c?.active ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const submit = async () => {
    setErr(null);
    if (!f.name.trim()) return setErr('Firma adı zorunlu.');
    const tax = f.tax_no.replace(/\s/g, '');
    if (tax && !/^[0-9]{10,11}$/.test(tax)) return setErr('VKN 10, TCKN 11 haneli olmalı.');
    const price = f.price.trim() ? parseNum(f.price) : null;
    if (f.price.trim() && (price === null || price < 0)) return setErr('Kişi başı fiyat geçersiz.');
    try {
      await save.mutateAsync({ id: c?.id ?? null, draft: {
        name: f.name.trim(), kind: f.kind, tax_no: tax || null, tax_office: f.tax_office.trim() || null, address: f.address.trim() || null,
        city: f.city.trim() || null, district: f.district.trim() || null, contact_name: f.contact_name.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null, default_meal_price: price,
        vat_rate: parseNum(f.vat) ?? 10, payment_term_days: Math.round(parseNum(f.term) ?? 30), e_invoice: f.e_invoice,
        notes: f.notes.trim() || null, active: f.active,
      } });
      toast.ok(c ? 'Müşteri güncellendi' : 'Müşteri eklendi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  return (
    <Drawer open onClose={onClose} title={c ? c.name : 'Yeni müşteri'} subtitle="Fiyat, vade ve fatura bilgileri"
      footer={canEdit && <><Button onClick={onClose}>Vazgeç</Button><Button variant="holo" onClick={submit} loading={save.isPending}>Kaydet</Button></>}>
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Firma / kişi adı" className="col-span-2"><input className="tc-input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Çorlu OSB Tekstil A.Ş." /></Field>
          <Field label="Tür">
            <select className="tc-input" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="kurum">Kurum</option><option value="sahis">Şahıs</option>
            </select>
          </Field>
        </div>
        <div className="rounded-2xl ring-1 ring-line bg-card p-4 grid grid-cols-3 gap-3">
          <Field label="Kişi başı fiyat ₺" hint="KDV hariç"><input className="tc-input tc-num" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} /></Field>
          <Field label="KDV %"><input className="tc-input tc-num" inputMode="decimal" value={f.vat} onChange={(e) => set({ vat: e.target.value })} /></Field>
          <Field label="Vade (gün)"><input className="tc-input tc-num" inputMode="numeric" value={f.term} onChange={(e) => set({ term: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yetkili"><input className="tc-input" value={f.contact_name} onChange={(e) => set({ contact_name: e.target.value })} /></Field>
          <Field label="Telefon"><input className="tc-input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" /></Field>
          <Field label="E-posta" className="col-span-2"><input className="tc-input" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="VKN / TCKN"><input className="tc-input tc-num" value={f.tax_no} onChange={(e) => set({ tax_no: e.target.value })} inputMode="numeric" /></Field>
          <Field label="Vergi dairesi"><input className="tc-input" value={f.tax_office} onChange={(e) => set({ tax_office: e.target.value })} /></Field>
          <Field label="İl"><input className="tc-input" value={f.city} onChange={(e) => set({ city: e.target.value })} placeholder="Tekirdağ" /></Field>
          <Field label="İlçe"><input className="tc-input" value={f.district} onChange={(e) => set({ district: e.target.value })} placeholder="Çorlu" /></Field>
          <Field label="Adres" className="col-span-2"><textarea className="tc-input" rows={2} value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={f.e_invoice} onChange={(e) => set({ e_invoice: e.target.checked })} className="accent-[var(--tc-brand)]" /> e-Fatura mükellefi (değilse e-Arşiv kesilir)
        </label>
        <Field label="Not"><textarea className="tc-input" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} className="accent-[var(--tc-brand)]" /> Aktif
        </label>
      </fieldset>
      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
    </Drawer>
  );
}
