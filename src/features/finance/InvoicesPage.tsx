import { useMemo, useRef, useState } from 'react';
import { askConfirm } from '@/ui/confirm';
import { Check, FileInput, FilePlus2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useCan } from '@/app/session';
import { unitInfo } from '@/lib/domain';
import { suggestCategory, type Suggestion } from '@/lib/categorize';
import { monthKey, monthLabel, monthRange, shortDay, todayISO } from '@/lib/dates';
import { ROLES } from '@/lib/domain';
import { fmtNum, parseNum } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { UNIT_CODES, parseUbl, pricePerStockUnit, type UblInvoice, type UblLine } from '@/lib/ubl';
import { useRows } from '@/lib/crud';
import { mergeByIngredient } from '@/lib/stock';
import { MonthNav } from '@/ui/bits';
import { Button, Drawer, EmptyState, ErrorNote, Field, Loading, ModuleHero, Money, Panel, Pill, Tabs, cx, type Tone } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useIngredients, type Ingredient } from '../kitchen/api';
import { BulkBar, SelectBox, useSelection } from '@/ui/Selection';
import { useDeleteInvoice, useFinanceCategories, useInvoices, useSaveInvoice, useSupplierMemory, type PurchaseInvoice } from './api';
import { CategorySelect } from './EntryDrawer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cardNameFromLine, matchTone, type MatchTone } from '@/lib/purchasing';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportStats } from '@/reports/ReportFrame';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { fmtMoney } from '@/lib/format';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  taslak: { label: 'Onay bekliyor', tone: 'wait' },
  onaylandi: { label: 'Onaylandı', tone: 'ok' },
  reddedildi: { label: 'Reddedildi', tone: 'stop' },
};

interface ImportItem { key: string; file: string; inv?: UblInvoice; error?: string; suggestion?: Suggestion; category: string; duplicate?: boolean; saved?: boolean }

function useSuggest() {
  const cats = useFinanceCategories();
  const memory = useSupplierMemory();
  return (supplierName: string, taxNo: string | null, lines: string[] = []) =>
    suggestCategory({ supplierName, supplierTaxNo: taxNo, lineNames: lines }, cats.data ?? [], memory.data ?? []);
}

export function InvoicesPage() {
  const toast = useToast();
  const canEdit = useCan(ROLES.invoices);
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [status, setStatus] = useState<'all' | 'taslak' | 'onaylandi' | 'reddedildi'>('all');
  const { from, to } = monthRange(month);
  const invoices = useInvoices(from, to);
  const cats = useFinanceCategories();
  const save = useSaveInvoice();
  const suggest = useSuggest();
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<ImportItem[]>([]);
  const [detail, setDetail] = useState<PurchaseInvoice | null>(null);
  const [manual, setManual] = useState(false);
  const catName = (code: string) => (cats.data ?? []).find((c) => c.code === code)?.name ?? code;

  const [q, setQ] = useState('');
  const list = invoices.data ?? [];
  const shown = list.filter((i) => (status === 'all' || i.status === status) && matches(q, i.supplier_name, i.invoice_no, i.supplier_tax_no, catName(i.category_code)));
  const sel = useSelection(canEdit ? shown.map((i) => i.id) : []);
  const del = useDeleteInvoice();
  const bulkStatus = async (st: 'onaylandi' | 'reddedildi') => {
    const targets = shown.filter((i) => sel.has(i.id) && i.status !== st);
    try {
      for (const t of targets) await save.mutateAsync({ id: t.id, draft: { status: st } });
      toast.ok(st === 'onaylandi' ? `${targets.length} fatura onaylandı; giderlere ve borçlara işlendi` : `${targets.length} fatura reddedildi`);
      sel.clear();
    } catch (e) { toast.error(e); }
  };
  const bulkDelete = async () => {
    if (!await askConfirm(`${sel.count} fatura silinsin mi? Onaylıysa bağlı ödenmemiş gider kaydı da kalkar.`)) return;
    try { for (const id of sel.ids) await del.mutateAsync(id); toast.ok('Silindi'); sel.clear(); } catch (e) { toast.error(e); }
  };
  const approved = list.filter((i) => i.status === 'onaylandi');
  const byCat = approved.reduce<Record<string, number>>((a, i) => { a[i.category_code] = (a[i.category_code] ?? 0) + Number(i.net_amount); return a; }, {});
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const report = (): ReportSpec => ({
    title: 'Gelen Faturalar',
    subtitle: `${monthLabel(month)} · ${shown.length} fatura`,
    summary: [
      { label: 'Onaylı (KDV hariç)', value: fmtMoney(approved.reduce((s, i) => s + Number(i.net_amount), 0)) },
      ...Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, v]) => ({ label: catName(c), value: fmtMoney(v) })),
    ],
    table: {
      filename: `gelen-faturalar-${month}`,
      header: ['Tarih', 'Tedarikçi', 'VKN', 'Fatura no', 'Kalem', 'KDV hariç ₺', 'KDV ₺', 'Ödenecek ₺', 'Durum'],
      rows: shown.map((i) => [i.invoice_date, i.supplier_name, i.supplier_tax_no, i.invoice_no, catName(i.category_code), i.net_amount, i.vat_amount, i.total_amount, STATUS[i.status]?.label]),
    },
    body: () => (
      <>
        <ReportStats items={[
          { label: 'Fatura', value: shown.length },
          { label: 'KDV hariç', value: fmtMoney(shown.reduce((s, i) => s + Number(i.net_amount), 0)) },
          { label: 'KDV', value: fmtMoney(shown.reduce((s, i) => s + Number(i.vat_amount), 0)) },
          { label: 'Ödenecek', value: fmtMoney(shown.reduce((s, i) => s + Number(i.total_amount), 0)) },
        ]} />
        <table>
          <thead><tr><th>Tarih</th><th>Tedarikçi</th><th>Kalem</th><th className="num">KDV hariç</th><th className="num">Ödenecek</th><th>Durum</th></tr></thead>
          <tbody>{shown.map((i) => <tr key={i.id}><td>{shortDay(i.invoice_date)}</td><td>{i.supplier_name}<div style={{ color: '#857B6D' }}>{i.invoice_no}</div></td>
            <td>{catName(i.category_code)}</td><td className="num">{fmtMoney(i.net_amount)}</td><td className="num">{fmtMoney(i.total_amount)}</td><td>{STATUS[i.status]?.label}</td></tr>)}</tbody>
        </table>
      </>
    ),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const items: ImportItem[] = [];
    for (const f of Array.from(files)) {
      const key = `${f.name}-${f.size}-${Math.random()}`;
      try {
        const inv = parseUbl(await f.text());
        const s = suggest(inv.supplierName, inv.supplierTaxNo, inv.lines.map((l) => l.name));
        items.push({ key, file: f.name, inv, suggestion: s, category: s.code });
      } catch (e) {
        items.push({ key, file: f.name, error: (e as Error).message, category: 'diger_gider' });
      }
    }
    const ettns = items.map((i) => i.inv?.ettn).filter(Boolean) as string[];
    if (ettns.length) {
      const existing = unwrap(await supabase.from('purchase_invoices').select('ettn').in('ettn', ettns));
      const set = new Set(existing.map((e) => e.ettn));
      for (const it of items) if (it.inv?.ettn && set.has(it.inv.ettn)) it.duplicate = true;
    }
    setQueue((q) => [...items, ...q]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const saveItem = async (it: ImportItem, approve: boolean) => {
    const inv = it.inv!;
    try {
      await save.mutateAsync({ id: null, draft: {
        supplier_name: inv.supplierName, supplier_tax_no: inv.supplierTaxNo, invoice_no: inv.invoiceNo, invoice_date: inv.issueDate,
        ettn: inv.ettn, category_code: it.category, net_amount: inv.netAmount, vat_amount: inv.vatAmount, total_amount: inv.payableAmount,
        due_date: inv.dueDate, status: approve ? 'onaylandi' : 'taslak', source: 'ubl_xml',
        lines: inv.lines as unknown as never,
        note: inv.withholdingAmount > 0 ? `Tevkifat: ${fmtNum(inv.withholdingAmount)} ₺` : null,
      } });
      setQueue((q) => q.filter((x) => x.key !== it.key));
      toast.ok(approve ? `${inv.supplierName}: onaylandı, giderlere işlendi` : `${inv.supplierName}: taslak kaydedildi`);
    } catch (e) { toast.error(e); }
  };

  const approveAll = async () => {
    for (const it of queue.filter((x) => x.inv && !x.duplicate)) await saveItem(it, true);
  };

  return (
    <>
      <ModuleHero
        kicker="Finans · e-Fatura"
        title="Gelen Faturalar"
        description="e-Fatura / e-Arşiv XML dosyalarını yükleyin: tedarikçi, tutar ve gider kalemi (elektrik, su, mazot, kasap…) otomatik bulunur. Onaylanan fatura Giderler’e ve ödenecekler listesine düşer."
        actions={<>
          <ReportButton spec={report} disabled={list.length === 0} />
          {canEdit && <><Button icon={<FilePlus2 className="w-4 h-4" />} onClick={() => setManual(true)}>Elle fatura</Button>
          <Button variant="primary" icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>XML yükle</Button>
          <input ref={fileRef} type="file" accept=".xml,application/xml,text/xml" multiple hidden onChange={(e) => void onFiles(e.target.files)} /></>}
        </>}
        stats={[
          { label: `${monthLabel(month)} onaylı`, value: <Money value={approved.reduce((s, i) => s + Number(i.net_amount), 0)} />, hint: `${approved.length} fatura · KDV hariç` },
          { label: 'Onay bekleyen', value: list.filter((i) => i.status === 'taslak').length, tone: list.some((i) => i.status === 'taslak') ? 'warn' : 'default' },
          { label: 'En büyük kalem', value: topCat ? catName(topCat[0]) : '—', hint: topCat ? <Money value={topCat[1]} /> : undefined },
          { label: 'Tedarikçi', value: new Set(list.map((i) => i.supplier_tax_no ?? i.supplier_name)).size },
        ]}
      />

      {queue.length > 0 && (
        <Panel className="mb-5" title={<span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent-strong" />Yüklenen faturalar</span>}
          subtitle="Kategoriyi kontrol edin; gerekirse değiştirip onaylayın"
          action={queue.some((x) => x.inv && !x.duplicate) && <Button size="sm" variant="primary" icon={<Check className="w-3.5 h-3.5" />} onClick={approveAll} loading={save.isPending}>Tümünü onayla</Button>}>
          <ul className="divide-y divide-line -my-2">
            {queue.map((it) => (
              <li key={it.key} className="py-3 flex flex-col md:flex-row md:items-center gap-3">
                {it.error ? (
                  <div className="flex-1 text-sm"><b className="text-ink">{it.file}</b><div className="text-stop text-xs mt-0.5">{it.error}</div></div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">{it.inv!.supplierName}</div>
                    <div className="text-[11px] text-ink-3">
                      {it.inv!.invoiceNo} · {shortDay(it.inv!.issueDate)} · {it.inv!.lines.length} kalem
                      {it.inv!.withholdingAmount > 0 && ' · tevkifatlı'}
                    </div>
                    {it.duplicate && <div className="text-[11px] text-stop font-semibold mt-0.5">Bu fatura (ETTN) zaten kayıtlı</div>}
                  </div>
                )}
                {it.inv && (
                  <>
                    <div className="md:w-64">
                      <CategorySelect kind="gider" value={it.category} onChange={(v) => setQueue((q) => q.map((x) => (x.key === it.key ? { ...x, category: v } : x)))} />
                      {it.suggestion && <div className="text-[10px] text-ink-3 mt-1">Öneri: {it.suggestion.reason}</div>}
                    </div>
                    <div className="text-right md:w-32">
                      <Money value={it.inv.netAmount} className="text-sm font-bold text-ink" />
                      <div className="text-[10px] text-ink-3">ödenecek <Money value={it.inv.payableAmount} /></div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" disabled={it.duplicate} onClick={() => saveItem(it, false)}>Taslak</Button>
                      <Button size="sm" variant="primary" disabled={it.duplicate} onClick={() => saveItem(it, true)}>Onayla</Button>
                    </div>
                  </>
                )}
                <button type="button" className="p-1.5 text-ink-3 hover:text-stop self-end md:self-auto" aria-label="Listeden çıkar"
                  onClick={() => setQueue((q) => q.filter((x) => x.key !== it.key))}><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <MonthNav value={month} onChange={setMonth} />
        <Tabs value={status} onChange={setStatus} items={[
          { id: 'all', label: 'Tümü', count: list.length },
          { id: 'taslak', label: 'Onay bekleyen', count: list.filter((i) => i.status === 'taslak').length },
          { id: 'onaylandi', label: 'Onaylı', count: approved.length },
          { id: 'reddedildi', label: 'Reddedilen', count: list.filter((i) => i.status === 'reddedildi').length },
        ]} />
      </div>

      <Panel pad={false}>
        <ListToolbar search={q} onSearch={setQ} placeholder="Tedarikçi, fatura no, VKN, kalem ara…" />
        {invoices.isLoading ? <Loading /> : invoices.error ? <div className="p-4"><ErrorNote>Faturalar yüklenemedi.</ErrorNote></div>
          : shown.length === 0 ? (
            <EmptyState icon={<FileInput className="w-5 h-5" />} title="Bu ay fatura yok"
              action={canEdit && <Button variant="primary" icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>XML yükle</Button>}>
              Muhasebe programınızdan veya GİB portalından indirdiğiniz e-fatura XML dosyalarını toplu yükleyebilirsiniz. Entegratör bağlantısı kurulduğunda faturalar kendiliğinden düşecek.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                    {canEdit && <th className="pl-4 w-8"><SelectBox label="Tümünü seç" checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} /></th>}
                    <th className="px-4 py-2.5 font-semibold">Tarih</th>
                    <th className="px-3 py-2.5 font-semibold">Tedarikçi</th>
                    <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Kalem</th>
                    <th className="px-3 py-2.5 font-semibold">Durum</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i) => (
                    <tr key={i.id} onClick={() => setDetail(i)} className={cx('border-b border-line last:border-0 cursor-pointer hover:bg-surface-2', sel.has(i.id) && 'bg-brand-soft/40')}>
                      {canEdit && <td className="pl-4" onClick={(e) => e.stopPropagation()}><SelectBox label={`${i.supplier_name} seç`} checked={sel.has(i.id)} onChange={() => sel.toggle(i.id)} /></td>}
                      <td className="px-4 py-2.5 tc-num text-ink-2 whitespace-nowrap">{shortDay(i.invoice_date)}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-ink">{i.supplier_name}</div>
                        <div className="text-[11px] text-ink-3">{i.invoice_no}{i.source === 'ubl_xml' ? ' · e-Fatura' : ''}</div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-ink-2">{catName(i.category_code)}</td>
                      <td className="px-3 py-2.5"><Pill tone={STATUS[i.status]?.tone}>{STATUS[i.status]?.label}</Pill></td>
                      <td className="px-4 py-2.5 text-right">
                        <Money value={i.net_amount} className="font-semibold text-ink" />
                        <div className="text-[10px] text-ink-3">ödenecek <Money value={i.total_amount} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

      <BulkBar count={sel.count} onClear={sel.clear} noun="fatura">
        <Button size="sm" variant="holo" icon={<Check className="w-3.5 h-3.5" />} onClick={() => bulkStatus('onaylandi')} loading={save.isPending}>Onayla</Button>
        <Button size="sm" onClick={() => bulkStatus('reddedildi')}>Reddet</Button>
        <Button size="sm" variant="danger" onClick={bulkDelete} loading={del.isPending}>Sil</Button>
      </BulkBar>
      {detail && <InvoiceDrawer invoice={detail} canEdit={canEdit} onClose={() => setDetail(null)} />}
      {manual && <ManualInvoiceDrawer onClose={() => setManual(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------- Detay + fiyat aktarımı
const TONE_DOT: Record<MatchTone, string> = { yesil: 'bg-ok', sari: 'bg-wait', kirmizi: 'bg-stop' };
const TONE_LABEL: Record<MatchTone, string> = { yesil: 'Otomatik eşleşti', sari: 'Benzerlik: kontrol edin', kirmizi: 'Eşleşme yok: seçin ya da yeni kart açın' };
const KAYNAK: Record<string, string> = { kod: '· satıcı kodu', alias_tedarikci: '· bu tedarikçinin adı', ad: '· aynı ad', alias_genel: '· bilinen ad', benzerlik: '· benzer' };
function matchIngredient(line: UblLine, ings: Ingredient[]): Ingredient | undefined {
  const n = line.name.toLocaleLowerCase('tr');
  return ings.filter((i) => i.active).sort((a, b) => b.name.length - a.name.length)
    .find((i) => n.includes(i.name.toLocaleLowerCase('tr')));
}

function InvoiceDrawer({ invoice, canEdit, onClose }: { invoice: PurchaseInvoice; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const save = useSaveInvoice();
  const del = useDeleteInvoice();
  const ingredients = useIngredients();
  const [category, setCategory] = useState(invoice.category_code);
  const [due, setDue] = useState(invoice.due_date ?? '');
  const lines = (Array.isArray(invoice.lines) ? invoice.lines : []) as unknown as UblLine[];
  const ings = ingredients.data ?? [];
  const [map, setMap] = useState<Record<number, string>>(() => ({}));
  // Tek kapı: fatura bir satınalma siparişine bağlıysa ve o sipariş teslim alınırken stoğa girdiyse fatura yalnız fiyatı günceller
  const suppliers = useRows('suppliers', { order: 'name' });
  const supplier = (suppliers.data ?? []).find((x) => (invoice.supplier_tax_no && x.tax_no === invoice.supplier_tax_no)
    || x.name.toLocaleLowerCase('tr') === invoice.supplier_name.toLocaleLowerCase('tr'));
  // Faz 3E: satır başına veritabanı adayları (satıcı kodu → tedarikçi adı → birebir ad → genel takma ad → benzerlik)
  const isFood = category === 'gida_hammadde';
  const cands = useQuery({
    queryKey: ['invoice-match', invoice.id, supplier?.id ?? '-', lines.length],
    enabled: isFood && lines.length > 0 && !suppliers.isLoading,
    queryFn: async () => Promise.all(lines.map(async (l) => unwrap(await supabase.rpc('match_invoice_line', { p_supplier_id: (supplier?.id ?? null) as string, p_raw: l.name })) ?? [])),
  });
  const candFor = (i: number) => cands.data?.[i] ?? [];
  const auto = useMemo(() => Object.fromEntries(lines.map((l, i) => {
    const top = cands.data?.[i]?.[0];
    if (top && matchTone(top.score) !== 'kirmizi') return [i, top.ingredient_id];
    return [i, cands.data ? '' : matchIngredient(l, ings)?.id ?? ''];
  })), [lines, ings, cands.data]);
  const chosen = (i: number) => map[i] ?? auto[i] ?? '';
  const toneFor = (i: number): MatchTone => {
    const id = chosen(i); if (!id) return 'kirmizi';
    const c = candFor(i).find((x) => x.ingredient_id === id);
    return map[i] !== undefined ? 'yesil' : matchTone(c?.score ?? null);
  };
  const [busy, setBusy] = useState(false);
  const newCard = async (i: number) => {
    const l = lines[i];
    const similar = candFor(i).slice(0, 5);
    const name = window.prompt(`Yeni stok kartı adı (faturadaki: "${l.name}")${similar.length ? `\n\nBenzer kartlar var — önce bunlardan biri olmadığından emin olun:\n${similar.map((x) => `• ${x.name}`).join('\n')}` : ''}`, cardNameFromLine(l.name));
    if (!name?.trim()) return;
    if (similar.some((x) => x.name.toLocaleLowerCase('tr') === name.trim().toLocaleLowerCase('tr'))) return toast.error('Bu adla kart zaten var; listeden seçin');
    const unit = UNIT_CODES[l.unitCode] ?? 'adet';
    try {
      const row = unwrap(await supabase.from('ingredients').insert({ name: name.trim(), stock_unit: ['kg', 'g', 'lt', 'ml', 'adet'].includes(unit) ? unit : 'adet', category: 'diger' }).select('id').single());
      if (supplier) await supabase.rpc('confirm_alias', { p_ingredient: row.id, p_supplier: supplier.id, p_raw: l.name });
      await qc.invalidateQueries({ queryKey: ['ingredients'] });
      setMap((m) => ({ ...m, [i]: row.id }));
      toast.ok('Stok kartı açıldı ve faturadaki adı tedarikçi adı olarak kaydedildi; kategorisini kartından düzeltin');
    } catch (e) { toast.error(e); }
  };
  const pos = useRows('purchase_orders', { key: ['fatura-bag', supplier?.id ?? '-'], order: 'order_date', ascending: false, enabled: Boolean(supplier),
    filter: (q) => q.eq('supplier_id', supplier!.id).neq('status', 'iptal') });
  const [poId, setPoId] = useState(invoice.purchase_order_id ?? '');

  const setStatus = async (status: string) => {
    try {
      await save.mutateAsync({ id: invoice.id, draft: { status, category_code: category, due_date: due || null, purchase_order_id: poId || null } });
      toast.ok(status === 'onaylandi' ? 'Onaylandı; giderlere işlendi' : status === 'reddedildi' ? 'Reddedildi' : 'Kaydedildi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  const pushPrices = async () => {
    const rows = lines.map((l, i) => {
      const ing = ings.find((x) => x.id === chosen(i));
      const price = ing ? pricePerStockUnit(l, ing.stock_unit) : null;
      return ing && price !== null ? { ingredient_id: ing.id, price: Math.round(price * 10000) / 10000, source: 'alis_faturasi', supplier_name: invoice.supplier_name, supplier_id: supplier?.id ?? null, purchase_invoice_id: invoice.id, invoice_line_no: i + 1, noted_at: `${invoice.invoice_date}T12:00:00+03:00` } : null;
    }).filter(Boolean) as Array<{ ingredient_id: string; price: number; source: string; supplier_name: string; supplier_id: string | null; purchase_invoice_id: string; invoice_line_no: number; noted_at: string }>;
    if (rows.length === 0) return toast.error('Eşleşen ve birimi uyumlu kalem yok');
    // Stok girişi: faturadaki miktar hammaddenin stok birimine çevrilir (aynı fatura ikinci kez stoğa girmez)
    const stock = lines.map((l, i) => {
      const ing = ings.find((x) => x.id === chosen(i));
      const lu = UNIT_CODES[l.unitCode];
      if (!ing || !lu || !(l.quantity > 0)) return null;
      const a = unitInfo(lu), b = unitInfo(ing.stock_unit);
      if (a.base !== b.base) return null;
      const price = pricePerStockUnit(l, ing.stock_unit);
      return { ingredient_id: ing.id, move_date: invoice.invoice_date, kind: 'giris', qty: Math.round(l.quantity * a.toBase / b.toBase * 1000) / 1000,
        unit_cost: price === null ? null : Math.round(price * 10000) / 10000, source: 'fatura', source_id: invoice.id, note: `${invoice.supplier_name} · ${invoice.invoice_no}` };
    }).filter(Boolean) as Array<{ ingredient_id: string; qty: number; unit_cost: number | null }>;
    setBusy(true);
    try {
      if ((invoice.purchase_order_id ?? '') !== poId) unwrap(await supabase.from('purchase_invoices').update({ purchase_order_id: poId || null }).eq('id', invoice.id).select('id'));
      unwrap(await supabase.from('ingredient_prices').insert(rows).select('id'));
      const already = unwrap(await supabase.from('stock_movements').select('id').eq('source', 'fatura').eq('source_id', invoice.id).limit(1));
      // Tedarikçi adını öğren: bir sonraki faturada bu satır otomatik eşleşir
      if (supplier) {
        for (let i = 0; i < lines.length; i++) {
          const id = chosen(i); const top = candFor(i)[0];
          if (!id || (top && top.ingredient_id === id && (top.kaynak === 'kod' || top.kaynak === 'alias_tedarikci'))) continue;
          await supabase.rpc('confirm_alias', { p_ingredient: id, p_supplier: supplier.id, p_raw: lines[i].name });
        }
      }
      // Faz 3E tek kapı: her kalem receive_stock ile tedarikçi etiketli partiye girer; sipariş teslimiyle zaten girdiyse parti tamamlanır
      let entered = 0, matched = 0;
      if (already.length === 0) {
        for (const r of mergeByIngredient(stock)) {
          const res = unwrap(await supabase.rpc('receive_stock', { p_ingredient: r.ingredient_id, p_qty: r.qty, p_unit_cost: r.unit_cost ?? undefined, p_source: 'fatura', p_source_id: invoice.id, p_supplier: supplier?.id, p_date: invoice.invoice_date, p_note: `${invoice.supplier_name} · ${invoice.invoice_no}` })) as { durum?: string } | null;
          if (res?.durum === 'eslesti') matched++; else entered++;
        }
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['ingredients'] }), qc.invalidateQueries({ queryKey: ['recipe_costs'] }), qc.invalidateQueries({ queryKey: ['menu_costs'] }), qc.invalidateQueries({ queryKey: ['t'] }), qc.invalidateQueries({ queryKey: ['t', 'purchase_invoices'] })]);
      toast.ok(`${rows.length} stok kartının fiyatı güncellendi${entered ? `, ${entered} kalem stoğa girdi` : ''}${matched ? `; ${matched} kalem sipariş teslimiyle zaten stoktaydı, partisi faturaya bağlandı` : ''}; reçete maliyetleri yenilendi`);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!await askConfirm('Fatura silinsin mi? Ödenmemiş gider kaydı da kalkar.')) return;
    try { await del.mutateAsync(invoice.id); toast.ok('Silindi'); onClose(); } catch (e) { toast.error(e); }
  };

  return (
    <Drawer open wide onClose={onClose} title={invoice.supplier_name}
      subtitle={`${invoice.invoice_no} · ${shortDay(invoice.invoice_date)}${invoice.supplier_tax_no ? ` · VKN ${invoice.supplier_tax_no}` : ''}`}
      footer={canEdit && <>
        <Button variant="danger" className="mr-auto" icon={<Trash2 className="w-4 h-4" />} onClick={remove} loading={del.isPending}>Sil</Button>
        {invoice.status !== 'reddedildi' && <Button onClick={() => setStatus('reddedildi')}>Reddet</Button>}
        {invoice.status === 'onaylandi'
          ? <Button variant="primary" onClick={() => setStatus('onaylandi')} loading={save.isPending}>Kaydet</Button>
          : <Button variant="holo" icon={<Check className="w-4 h-4" />} onClick={() => setStatus('onaylandi')} loading={save.isPending}>Onayla</Button>}
      </>}>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="tc-card p-3"><div className="text-[11px] text-ink-3">KDV hariç</div><Money value={invoice.net_amount} className="font-bold" /></div>
        <div className="tc-card p-3"><div className="text-[11px] text-ink-3">KDV</div><Money value={invoice.vat_amount} className="font-bold" /></div>
        <div className="tc-card p-3"><div className="text-[11px] text-ink-3">Ödenecek</div><Money value={invoice.total_amount} className="font-bold" /></div>
      </div>
      <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-3 mb-5">
        <Field label="Gider kalemi"><CategorySelect kind="gider" value={category} onChange={setCategory} /></Field>
        <Field label="Vade"><input type="date" className="tc-input tc-num" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        {supplier && (
          <Field label="Bağlı satınalma siparişi" className="col-span-2" hint="Mal sipariş teslimiyle stoğa girdiyse fatura stoğu ikinci kez artırmaz; gider yalnız bu faturadan yazılır.">
            <select className="tc-input" value={poId} onChange={(e) => setPoId(e.target.value)}>
              <option value="">— bağlı sipariş yok —</option>
              {(pos.data ?? []).map((p) => <option key={p.id} value={p.id}>{shortDay(p.order_date)} · {fmtMoney(Number(p.total))} · {p.status === 'teslim' ? 'teslim alındı' : p.status}</option>)}
            </select>
          </Field>
        )}
      </fieldset>
      {invoice.note && <p className="text-xs text-ink-3 mb-4">{invoice.note}</p>}

      {lines.length > 0 && (
        <Panel pad={false} title="Kalemler" subtitle={category === 'gida_hammadde' ? 'Yeşil: otomatik eşleşti · Sarı: benzerlik, kontrol edin · Kırmızı: seçin ya da yeni kart açın. Onayladığınız adlar bu tedarikçinin sonraki faturalarında otomatik eşleşir.' : undefined}
          action={canEdit && category === 'gida_hammadde' && <Button size="sm" variant="primary" onClick={pushPrices} loading={busy}>Fiyat ve stoğa işle</Button>}>
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="px-4 py-2 font-semibold">Kalem</th>
                  <th className="px-2 py-2 font-semibold text-right">Miktar</th>
                  <th className="px-2 py-2 font-semibold text-right">Birim fiyat</th>
                  <th className="px-2 py-2 font-semibold text-right">Tutar</th>
                  {category === 'gida_hammadde' && <th className="px-4 py-2 font-semibold">Stok kartı</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const ing = ings.find((x) => x.id === chosen(i));
                  const pp = ing ? pricePerStockUnit(l, ing.stock_unit) : null;
                  return (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 text-ink">{l.name}</td>
                      <td className="px-2 py-2 text-right tc-num text-ink-2 whitespace-nowrap">{fmtNum(l.quantity, 3)} {UNIT_CODES[l.unitCode] ?? l.unitCode}</td>
                      <td className="px-2 py-2 text-right"><Money value={l.unitPrice} precise /></td>
                      <td className="px-2 py-2 text-right font-semibold"><Money value={l.lineTotal} /></td>
                      {category === 'gida_hammadde' && (
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[toneFor(i)])} title={TONE_LABEL[toneFor(i)]} aria-label={TONE_LABEL[toneFor(i)]} />
                            <select className="tc-input !py-1.5" value={chosen(i)} disabled={!canEdit} onChange={(e) => setMap({ ...map, [i]: e.target.value })} aria-label="Stok kartı">
                              <option value="">— eşleştirme yok —</option>
                              {candFor(i).length > 0 && <optgroup label="Öneriler">
                                {candFor(i).map((c) => <option key={`c${c.ingredient_id}`} value={c.ingredient_id}>{c.name} · %{Math.round(Number(c.score) * 100)} {KAYNAK[c.kaynak] ?? ''}</option>)}
                              </optgroup>}
                              <optgroup label="Tüm stok kartları">
                                {ings.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.stock_unit})</option>)}
                              </optgroup>
                            </select>
                            {canEdit && toneFor(i) === 'kirmizi' && <Button size="sm" onClick={() => newCard(i)}>Yeni kart</Button>}
                          </div>
                          {ing && (pp === null
                            ? <div className="text-[10px] text-stop mt-0.5">Birim uyumsuz ({UNIT_CODES[l.unitCode] ?? l.unitCode} → {ing.stock_unit})</div>
                            : <div className={cx('text-[10px] mt-0.5', ing.last_price && pp > Number(ing.last_price) ? 'text-stop' : 'text-ok')}>
                                <Money value={pp} precise /> / {ing.stock_unit} {ing.last_price ? <>· önceki <Money value={ing.last_price} /></> : ''}
                              </div>)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </Drawer>
  );
}

function ManualInvoiceDrawer({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const save = useSaveInvoice();
  const suggest = useSuggest();
  const [f, setF] = useState({ supplier: '', tax: '', no: '', date: todayISO(), category: 'diger_gider', net: '', vat: '', total: '', due: '' });
  const [hint, setHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const guess = () => {
    if (!f.supplier.trim()) return;
    const s = suggest(f.supplier, f.tax || null);
    if (s.confidence !== 'varsayilan') { set({ category: s.code }); setHint(`Öneri: ${s.reason}`); }
  };

  const submit = async (approve: boolean) => {
    setErr(null);
    const net = parseNum(f.net), vat = parseNum(f.vat) ?? 0;
    const total = f.total.trim() ? parseNum(f.total) : net !== null ? net + vat : null;
    if (!f.supplier.trim() || !f.no.trim()) return setErr('Tedarikçi ve fatura no zorunlu.');
    if (net === null || net < 0 || total === null) return setErr('Tutarları kontrol edin.');
    try {
      await save.mutateAsync({ id: null, draft: {
        supplier_name: f.supplier.trim(), supplier_tax_no: f.tax.trim() || null, invoice_no: f.no.trim(), invoice_date: f.date,
        category_code: f.category, net_amount: net, vat_amount: vat, total_amount: total, due_date: f.due || null,
        status: approve ? 'onaylandi' : 'taslak', source: 'manuel',
      } });
      toast.ok('Fatura kaydedildi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  return (
    <Drawer open onClose={onClose} title="Elle fatura" subtitle="Kâğıt fatura veya XML’i olmayan belgeler için"
      footer={<><Button onClick={onClose}>Vazgeç</Button><Button onClick={() => submit(false)} loading={save.isPending}>Taslak</Button>
        <Button variant="primary" onClick={() => submit(true)} loading={save.isPending}>Onayla</Button></>}>
      <div className="space-y-4">
        <Field label="Tedarikçi unvanı"><input className="tc-input" value={f.supplier} onChange={(e) => set({ supplier: e.target.value })} onBlur={guess} placeholder="Trakya Elektrik Perakende" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="VKN / TCKN"><input className="tc-input tc-num" value={f.tax} onChange={(e) => set({ tax: e.target.value })} onBlur={guess} /></Field>
          <Field label="Fatura no"><input className="tc-input" value={f.no} onChange={(e) => set({ no: e.target.value })} /></Field>
          <Field label="Fatura tarihi"><input type="date" className="tc-input tc-num" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Vade"><input type="date" className="tc-input tc-num" value={f.due} onChange={(e) => set({ due: e.target.value })} /></Field>
        </div>
        <Field label="Gider kalemi" hint={hint ?? undefined}><CategorySelect kind="gider" value={f.category} onChange={(v) => set({ category: v })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="KDV hariç ₺"><input className="tc-input tc-num" inputMode="decimal" value={f.net} onChange={(e) => set({ net: e.target.value })} /></Field>
          <Field label="KDV ₺"><input className="tc-input tc-num" inputMode="decimal" value={f.vat} onChange={(e) => set({ vat: e.target.value })} /></Field>
          <Field label="Ödenecek ₺" hint="Boşsa toplam"><input className="tc-input tc-num" inputMode="decimal" value={f.total} onChange={(e) => set({ total: e.target.value })} /></Field>
        </div>
        {err && <ErrorNote>{err}</ErrorNote>}
      </div>
    </Drawer>
  );
}
