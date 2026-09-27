import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, CheckCheck, ClipboardCheck, ClipboardList, CookingPot, FileDown,
  PackageCheck, Printer, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { useCan } from '@/app/session';
import { supabase } from '@/lib/supabase';
import { todayISO, dayLabel } from '@/lib/dates';
import { MEALS, type AppRole } from '@/lib/domain';
import { fmtMoney, fmtNum } from '@/lib/format';
import { orderPeople, useOrders } from '@/features/sales/api';
import { useCustomers } from '@/features/sales/api';
import { effectiveMenu, useMenuPlans, usePrepBatches, usePrepItems, type PrepItem } from '@/features/production/api';
import { useMenuCosts } from '@/features/kitchen/api';
import { useCompany } from '@/features/settings/api';
import { DateNav } from '@/ui/bits';
import { askConfirm } from '@/ui/confirm';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import {
  useApproveProductionOrder, useBuildProductionOrder, useCheckProductionOrder, useCloseProductionOrder,
  useProductionOrder, useRecordWorkOrderPrint, useWorkOrders,
} from './ordersApi';
import type { Json } from '@/lib/database.types';

const MEAL_ITEMS = Object.entries(MEALS).map(([id, label]) => ({ id, label }));
const STAGES = [
  { id: 'taslak', label: 'Hazırlık', icon: CookingPot },
  { id: 'kontrol', label: 'Kontrol', icon: ClipboardCheck },
  { id: 'onaylandi', label: 'Onay', icon: ShieldCheck },
  { id: 'kapandi', label: 'Tamamlandı', icon: PackageCheck },
] as const;
const ROLE_APPROVER: AppRole[] = ['yonetici', 'asci_basi'];
const STATUS: Record<string, { label: string; tone: 'idle' | 'wait' | 'ok' | 'stop' | 'info' }> = {
  taslak: { label: 'Taslak', tone: 'idle' },
  kontrol: { label: 'Kontrol bekliyor', tone: 'wait' },
  onaylandi: { label: 'Onaylandı', tone: 'info' },
  uretildi: { label: 'Üretildi', tone: 'info' },
  kapandi: { label: 'Kapatıldı', tone: 'ok' },
  iptal: { label: 'İptal edildi', tone: 'stop' },
};

interface ProductionAnomaly { tur?: string; yemek?: string; malzeme?: string; mesaj?: string }
function readAnomalies(value: Json | null | undefined): ProductionAnomaly[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    return [{
      tur: typeof item.tur === 'string' ? item.tur : undefined,
      yemek: typeof item.yemek === 'string' ? item.yemek : undefined,
      malzeme: typeof item.malzeme === 'string' ? item.malzeme : undefined,
      mesaj: typeof item.mesaj === 'string' ? item.mesaj : undefined,
    }];
  });
}

export function ProductionOrderPage() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO);
  const [meal, setMeal] = useState('ogle');
  const [forceNote, setForceNote] = useState('');
  const [deliverOrders, setDeliverOrders] = useState(false);
  const mayBuild = useCan(['yonetici', 'asci_basi', 'diyetisyen']);
  const mayApprove = useCan(ROLE_APPROVER);
  const mayCancel = useCan(['yonetici']);

  const order = useProductionOrder(date, meal);
  const orders = useOrders(date, date);
  const customers = useCustomers();
  const menus = useMenuCosts();
  const menuPlans = useMenuPlans(date, date);
  const prepBatches = usePrepBatches(date, date);
  const dayBatches = (prepBatches.data ?? []).filter((row) => row.meal === meal);
  const prepItems = usePrepItems(dayBatches.map((row) => row.batch_id).filter((id): id is string => Boolean(id)));
  const company = useCompany();
  const workOrders = useWorkOrders(order.data?.id ?? null);
  const build = useBuildProductionOrder();
  const check = useCheckProductionOrder();
  const approve = useApproveProductionOrder();
  const close = useCloseProductionOrder();
  const recordPrint = useRecordWorkOrderPrint();

  const mealOrders = (orders.data ?? []).filter((row) => row.meal === meal && row.status !== 'iptal');
  const people = mealOrders.reduce((sum, row) => sum + orderPeople(row), 0);
  const itemsByBatch = new Map<string, PrepItem[]>();
  for (const item of prepItems.data ?? []) itemsByBatch.set(item.batch_id ?? '', [...(itemsByBatch.get(item.batch_id ?? '') ?? []), item]);
  const groups = useMemo(() => {
    const grouped = new Map<string, { customerId: string; menuId: string | null; people: number; orderCount: number; delivered: number }>();
    for (const row of mealOrders) {
      const menuId = effectiveMenu(menuPlans.data ?? [], date, meal, row.customer_id, row.menu_id);
      const key = `${row.customer_id}|${menuId ?? 'atanmadi'}`;
      const current = grouped.get(key) ?? { customerId: row.customer_id, menuId, people: 0, orderCount: 0, delivered: 0 };
      current.people += orderPeople(row);
      current.orderCount += 1;
      if (row.status === 'teslim_edildi') current.delivered += 1;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.people - a.people);
  }, [mealOrders, menuPlans.data, date, meal]);

  const anomalies = readAnomalies(order.data?.anomalies);
  const status = order.data?.status ?? null;
  const stageIndex = status === 'kapandi' ? 3 : status === 'onaylandi' || status === 'uretildi' ? 2 : status === 'kontrol' ? 1 : 0;
  const workOrder = workOrders.data?.[0];
  const isMutating = build.isPending || check.isPending || approve.isPending || close.isPending;

  const run = async (task: () => Promise<unknown>, success: string) => {
    try { await task(); toast.ok(success); }
    catch (error) { toast.error(error); }
  };

  const buildOrder = async () => {
    if (status && !(await askConfirm('Üretim emri siparişlerden yeniden oluşturulacak. Sipariş kaynaklı mevcut hazırlık porsiyonları güncellenir; bu taslakta kontrol bulguları sıfırlanır. Elle hazırlanmış satırlar silinmez. Devam edilsin mi?'))) return;
    await run(() => build.mutateAsync({ date, meal }), 'Siparişler ve menü planı üretim emrine aktarıldı');
  };
  const checkOrder = async () => {
    try {
      const rows = await check.mutateAsync(order.data!.id);
      const count = Array.isArray(rows) ? rows.length : 0;
      toast.ok(count === 0 ? 'Kontrol tamamlandı; uyarı bulunmadı' : `Kontrol tamamlandı; ${count} uyarı incelenmeli`);
    } catch (error) { toast.error(error); }
  };

  const approveOrder = async () => {
    if (!order.data) return;
    const force = anomalies.length > 0;
    if (force && !forceNote.trim()) return toast.error('Uyarılara rağmen onay için gerekçe yazın');
    const message = force
      ? `Üretim emrinde ${anomalies.length} uyarı var. Gerekçeniz kaydedilerek yine de onaylanacak ve iş emri sabitlenecek. Devam edilsin mi?`
      : 'Üretim emri onaylanacak ve mutfak için değişmez iş emri anlık görüntüsü oluşturulacak. Devam edilsin mi?';
    const confirmation = force ? `${message}\n\nKaydedilecek gerekçe: ${forceNote.trim()}` : message;
    if (!(await askConfirm(confirmation))) return;
    await run(() => approve.mutateAsync({ id: order.data!.id, force, note: force ? forceNote.trim() : null }), 'Üretim emri onaylandı; yeni iş emri oluşturuldu');
  };

  const closeOrder = async () => {
    if (!order.data) return;
    const deliveryText = deliverOrders
      ? ' Ayrıca bekleyen/onaylı siparişler teslim edildi işaretlenecek ve otomatik gelir kayıtları oluşabilecek.'
      : ' Sipariş teslim durumları değiştirilmeyecek.';
    const message = `Üretim emri kapatılacak; stok çıkışı ve reçete kalibrasyonu kaydedilecek.${deliveryText} Bu adım üretim maliyetini de kesinleştirir. Devam edilsin mi?`;
    if (!(await askConfirm(message))) return;
    await run(() => close.mutateAsync({ id: order.data!.id, deliver: deliverOrders }), 'Üretim kapatıldı; stok ve kalibrasyon güncellendi');
  };

  const printWorkOrder = async () => {
    if (!workOrder) return;
    try { await recordPrint.mutateAsync(workOrder); } catch (error) { toast.error(error); }
    window.print();
  };

  const cancelOrder = async () => {
    if (!order.data) return;
    const note = window.prompt('Üretim emrini iptal etme gerekçesini yazın:')?.trim();
    if (!note) return;
    if (!(await askConfirm(`Üretim emri iptal edilecek. Bu öğün için yeniden üretim emri oluşturulamayabilir.\n\nİptal gerekçesi: ${note}`))) return;
    try {
      const { error } = await supabase.rpc('po_cancel', { p_id: order.data.id, p_note: note });
      if (error) throw error;
      await order.refetch(); toast.ok('Üretim emri iptal edildi');
    } catch (error) { toast.error(error); }
  };

  const titleDate = dayLabel(date);
  const currentStatus = status ? (STATUS[status] ?? STATUS.taslak) : null;

  return (
    <>
    <div className="space-y-4 print:hidden">
      <ModuleHero
        kicker="Mutfak · Siparişten üretime"
        title="Üretim Emri"
        description="Sipariş sayılarını hazırlığa bağlayın; kontrol, onay ve kapanışı izleyin. Kapanış stok ve reçete kalibrasyonunu işler."
        actions={workOrder && <Button icon={<Printer className="w-4 h-4" />} onClick={printWorkOrder}>İş emrini yazdır</Button>}
        stats={[
          { label: 'Üretim durumu', value: currentStatus ? <Pill tone={currentStatus.tone}>{currentStatus.label}</Pill> : 'Başlamadı', hint: `${titleDate} · ${MEALS[meal]}` },
          { label: 'Toplam kişi', value: fmtNum(order.data?.total_people ?? people, 0), hint: `${mealOrders.length} geçerli sipariş` },
          { label: 'Planlanan hammadde', value: order.data?.planned_cost == null ? '—' : fmtMoney(order.data.planned_cost), hint: 'Üretim emri tahmini' },
          { label: 'Uyarı', value: fmtNum(anomalies.length, 0), hint: anomalies.length ? 'Onay öncesi inceleyin' : 'Kontrolde çıkan kayıt', tone: anomalies.length ? 'warn' : 'good' },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <DateNav value={date} onChange={setDate} />
        <Tabs value={meal} onChange={setMeal} items={MEAL_ITEMS} />
      </div>

      {order.isLoading ? <Loading label="Üretim emri yükleniyor…" /> : order.error ? (
        <ErrorNote>Üretim emri okunamadı. Erişim ve Supabase bağlantısını kontrol edin.</ErrorNote>
      ) : (
        <>
          <Panel title="Üretim akışı" subtitle={`${titleDate} · ${MEALS[meal]} öğünü`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAGES.map((stage, index) => {
                const Icon = stage.icon;
                const done = Boolean(status) && (status === 'kapandi' || index < stageIndex || (index === stageIndex && index < 2));
                const active = Boolean(status) && index === stageIndex && status !== 'kapandi' && status !== 'iptal';
                return (
                  <div key={stage.id} className={cx('min-w-0 rounded-2xl border p-3 sm:p-4 transition',
                    done ? 'border-ok/25 bg-ok-soft/50' : active ? 'border-brand/25 bg-brand-soft/60' : 'border-line bg-surface-2/60')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cx('grid h-8 w-8 place-items-center rounded-xl', done ? 'bg-ok text-white' : active ? 'bg-brand text-white' : 'bg-card text-ink-3')}>
                        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className="tc-num text-[10px] font-semibold text-ink-3">0{index + 1}</span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-ink">{stage.label}</div>
                    <div className="mt-0.5 text-[11px] text-ink-3">{done ? 'Tamamlandı' : active ? 'Şu an' : 'Sırada'}</div>
                  </div>
                );
              })}
            </div>
            {status === 'iptal' && <div className="mt-3"><ErrorNote>Bu üretim emri iptal edildi. Durum geri alınamaz; yöneticiyle görüşün.</ErrorNote></div>}
          </Panel>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
            <div className="space-y-4 min-w-0">
              <Panel title="Sipariş dağılımı" subtitle="Firma ve menü bazında; iptal siparişler hariç" action={<Pill tone="info">{fmtNum(people, 0)} kişi</Pill>}>
                {orders.isLoading || customers.isLoading || menus.isLoading || menuPlans.isLoading ? <Loading label="Siparişler ve menüler yükleniyor…" />
                  : orders.error || customers.error || menus.error || menuPlans.error ? <ErrorNote>Sipariş dağılımı yüklenemedi.</ErrorNote>
                    : groups.length === 0 ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Bu öğün için sipariş yok">
                      Önce Siparişler veya Menü Planı ekranından kayıt girin. Üretim emri için uydurma kişi sayısı kullanılmaz.
                    </EmptyState> : (
                      <div className="overflow-x-auto -mx-2 sm:mx-0">
                        <table className="w-full min-w-[520px] text-sm">
                          <thead><tr className="border-b border-line text-[11px] text-ink-3"><th className="px-2 py-2 text-left font-semibold">Firma</th><th className="px-2 py-2 text-left font-semibold">Menü</th><th className="px-2 py-2 text-right font-semibold">Kişi</th><th className="px-2 py-2 text-right font-semibold">Sipariş</th></tr></thead>
                          <tbody>{groups.map((group) => {
                            const customer = customers.data?.find((row) => row.id === group.customerId);
                            const menu = menus.data?.find((row) => row.menu_id === group.menuId);
                            return <tr key={`${group.customerId}-${group.menuId ?? 'atanmadi'}`} className="border-b border-line last:border-0">
                              <td className="px-2 py-3 font-medium text-ink">{customer?.name ?? 'Firma kaydı yok'}</td>
                              <td className="px-2 py-3 text-ink-2">{menu?.name ?? <span className="text-ink-3">Menü atanmamış</span>}</td>
                              <td className="tc-num px-2 py-3 text-right font-semibold">{fmtNum(group.people, 0)}</td>
                              <td className="px-2 py-3 text-right text-ink-3">{group.orderCount} {group.delivered ? `· ${group.delivered} teslim` : ''}</td>
                            </tr>;
                          })}</tbody>
                        </table>
                      </div>
                    )}
              </Panel>

              <Panel title="Planlanan yemekler ve malzemeler" subtitle="Kayıtlı günlük hazırlık miktarları; sahte/otomatik tahmin eklenmez." action={<Pill tone="info">{dayBatches.length} yemek</Pill>}>
                {prepBatches.isLoading || prepItems.isLoading ? <Loading label="Hazırlık miktarları yükleniyor…" />
                  : prepBatches.error || prepItems.error ? <ErrorNote>Planlanan yemekler okunamadı.</ErrorNote>
                    : dayBatches.length === 0 ? <EmptyState icon={<CookingPot className="h-5 w-5" />} title="Hazırlık satırı yok">Emir oluşturma, mevcut sipariş/menü planına göre hazırlık başlıklarını açar.</EmptyState>
                      : <div className="space-y-2">{dayBatches.map((batch) => {
                        const batchItems = itemsByBatch.get(batch.batch_id ?? '') ?? [];
                        return <details key={batch.batch_id} className="group rounded-xl border border-line bg-card open:bg-surface-2/40">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3 [&::-webkit-details-marker]:hidden">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><CookingPot className="h-4 w-4" /></span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{batch.dish_name ?? 'Yemek'}</span><span className="text-[11px] text-ink-3">{batch.course ?? 'Kap belirtilmemiş'} · {batchItems.length} malzeme</span></span>
                            <span className="tc-num text-right text-sm font-semibold text-ink">{fmtNum(batch.portions ?? 0, 0)}<span className="ml-1 text-[10px] font-normal text-ink-3">porsiyon</span></span>
                            {batch.total_cost != null && <span className="hidden min-w-20 text-right text-xs text-ink-3 sm:block">{fmtMoney(batch.total_cost)}</span>}
                          </summary>
                          {batchItems.length > 0 ? <div className="border-t border-line px-3 py-2"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-xs">
                            {batchItems.map((item) => <div key={item.id} className="contents"><span className="border-b border-line/70 py-2 text-ink-2">{item.item_name ?? item.manual_name ?? 'Malzeme'}{item.is_side ? ' · yan' : ''}</span><span className="tc-num border-b border-line/70 py-2 text-right text-ink">{fmtNum(item.qty ?? item.planned_qty ?? 0, 3)} {item.unit ?? item.base_unit}</span></div>)}
                          </div></div> : <div className="border-t border-line px-3 py-3 text-xs text-ink-3">Bu hazırlık başlığında malzeme miktarı yok.</div>}
                        </details>;
                      })}</div>}
              </Panel>

              {anomalies.length > 0 && (
                <Panel title={<span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-wait" />Kontrol uyarıları</span>} subtitle="Aşağıdaki bulgular veritabanındaki kontrol fonksiyonundan gelir.">
                  <ul className="space-y-2">
                    {anomalies.map((item, index) => <li key={`${item.tur ?? 'uyari'}-${index}`} className="rounded-xl border border-wait/25 bg-wait-soft/50 p-3">
                      <div className="text-sm font-semibold text-ink">{item.yemek ?? item.malzeme ?? 'Üretim kontrolü'}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-ink-2">{item.mesaj ?? 'Detaylı açıklama yok'}</div>
                    </li>)}
                  </ul>
                  {mayApprove && status === 'kontrol' && <label className="mt-4 block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-2">Uyarılara rağmen onay gerekçesi</span>
                    <textarea className="tc-input min-h-20 resize-y" value={forceNote} onChange={(event) => setForceNote(event.target.value)} placeholder="Neyi kontrol ettiniz, neden devam ediyorsunuz?" />
                    <span className="mt-1 block text-[11px] text-ink-3">Gerekçe onay kaydına eklenir.</span>
                  </label>}
                </Panel>
              )}

              {status === 'onaylandi' || status === 'uretildi' || status === 'kapandi' ? (
                <Panel title="Mutfak iş emri" subtitle="Onay sırasında alınan anlık görüntü; sonradan değişen reçeteler eski revizyonu değiştirmez."
                  action={workOrder && <Pill tone="info">Rev. {workOrder.revision}</Pill>}>
                  {workOrders.isLoading ? <Loading label="İş emri yükleniyor…" /> : workOrders.error ? <ErrorNote>İş emri kaydı okunamadı.</ErrorNote>
                    : !workOrder ? <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="İş emri henüz oluşmadı">Yönetici veya aşçıbaşı onay verdiğinde mutfak için sabit kopya oluşturulur.</EmptyState>
                      : <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><ClipboardList className="h-5 w-5" /></div>
                        <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{titleDate} · {MEALS[meal]} üretim kopyası</div>
                          <div className="text-xs text-ink-3">Revizyon {workOrder.revision} · {workOrder.print_count} kez yazdırıldı{workOrder.printed_at ? ` · Son yazdırma ${new Date(workOrder.printed_at).toLocaleString('tr-TR')}` : ''}</div></div>
                        <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={printWorkOrder} loading={recordPrint.isPending}>A4 iş emrini yazdır</Button>
                      </div>}
                </Panel>
              ) : null}

              {order.data && status && status !== 'kapandi' && status !== 'iptal' && (
                <Panel title="Üretim emri notu" subtitle="Not yalnızca kayıtlıysa görüntülenir.">
                  <p className="whitespace-pre-wrap text-sm text-ink-2">{order.data.note || 'Henüz not girilmedi.'}</p>
                  <p className="mt-2 text-[11px] text-ink-3">Emir: {order.data.id}</p>
                </Panel>
              )}
            </div>

            <aside className="space-y-4 xl:sticky xl:top-4">
              <Panel title="Sıradaki adım" subtitle="Yetkinize uygun bir eylem seçin.">
                <div className="space-y-2">
                  {mayBuild && (!status || status === 'taslak' || status === 'kontrol') && <Button className="w-full justify-between" variant="primary" icon={<RefreshCw className="h-4 w-4" />} onClick={buildOrder} loading={build.isPending}>
                    {status ? 'Siparişlerden yenile' : 'Siparişlerden emir oluştur'} <ArrowRight className="h-4 w-4" />
                  </Button>}
                  {mayBuild && order.data && (status === 'taslak' || status === 'kontrol') && <Button className="w-full justify-between" icon={<ClipboardCheck className="h-4 w-4" />} onClick={checkOrder} loading={check.isPending}>
                    Üretim emrini kontrol et <ArrowRight className="h-4 w-4" />
                  </Button>}
                  {mayApprove && order.data && status === 'kontrol' && <Button className="w-full justify-between" variant="holo" icon={<ShieldCheck className="h-4 w-4" />} onClick={approveOrder} loading={approve.isPending}>
                    {anomalies.length ? 'Gerekçeyle onayla' : 'İş emrini onayla'} <ArrowRight className="h-4 w-4" />
                  </Button>}
                  {mayApprove && order.data && (status === 'onaylandi' || status === 'uretildi') && <>
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
                      <input className="mt-0.5 accent-brand" type="checkbox" checked={deliverOrders} onChange={(event) => setDeliverOrders(event.target.checked)} />
                      <span><b>Siparişleri teslim edildi işaretle.</b> Kapama sırasında gelir kaydı oluşturabilecek yan etkiyi açıkça etkinleştirir.</span>
                    </label>
                    <Button className="w-full justify-between" icon={<PackageCheck className="h-4 w-4" />} onClick={closeOrder} loading={close.isPending}>
                      Üretimi kapat <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>}
                  {mayCancel && order.data && status !== 'kapandi' && status !== 'iptal' && <Button className="w-full" variant="danger" onClick={cancelOrder} disabled={isMutating}>Yönetici olarak iptal et</Button>}
                </div>
                {!status && !order.isLoading && <p className="mt-3 text-xs leading-relaxed text-ink-3">Önce gün ve öğünü seçin. Kayıt yoksa siparişlerden üretim emri oluşturun.</p>}
                {status === 'kapandi' && <div className="mt-3 rounded-xl bg-ok-soft p-3 text-xs leading-relaxed text-ok"><CheckCheck className="mr-1 inline h-4 w-4" />Kapanış tamamlandı. Stok çıkışı tekilleştirilir; üretim gideri ayrıca yazılmaz.</div>}
              </Panel>

              <Panel title="İş emri çıktısı" subtitle="Onaylanan snapshot üzerinden A4 baskı." className="print:hidden">
                {workOrder ? <>
                  <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-strong"><FileDown className="h-5 w-5" /></div>
                    <div className="text-xs text-ink-2">Mutfak adımları, malzeme listesi ve müşteri kişi sayılarını içeren sabit kopya.</div></div>
                  <Button className="mt-4 w-full" variant="subtle" icon={<Printer className="h-4 w-4" />} onClick={printWorkOrder}>A4 olarak yazdır</Button>
                </> : <p className="text-sm text-ink-3">İş emri, üretim onaylandığında otomatik hazırlanır.</p>}
              </Panel>

              {company.data?.report_footer && <div className="px-3 text-center text-[11px] text-ink-3">{company.data.report_footer}</div>}
            </aside>
          </div>
        </>
      )}

      {isMutating && <div className="sr-only" aria-live="polite">İşlem sürüyor</div>}
    </div>
    {workOrder && <PrintWorkOrder workOrder={workOrder} date={date} meal={meal} company={company.data} />}
    </>
  );
}

function PrintWorkOrder({ workOrder, date, meal, company }: {
  workOrder: NonNullable<ReturnType<typeof useWorkOrders>['data']>[number];
  date: string; meal: string; company: ReturnType<typeof useCompany>['data'];
}) {
  const snapshot = workOrder.snapshot && typeof workOrder.snapshot === 'object' && !Array.isArray(workOrder.snapshot) ? workOrder.snapshot as Record<string, Json> : {};
  const dishes = Array.isArray(snapshot.yemekler) ? snapshot.yemekler as Array<Record<string, Json>> : [];
  const firms = Array.isArray(snapshot.firmalar) ? snapshot.firmalar as Array<Record<string, Json>> : [];
  const stock = Array.isArray(snapshot.cekme_listesi) ? snapshot.cekme_listesi as Array<Record<string, Json>> : [];
  return (
    <>
      <style>{`@page{size:A4;margin:12mm}@media print{body{background:#fff!important;color:#171717!important}.print-work-order{display:block!important}.screen-work-order-host{display:none!important}}.print-work-order{display:none}`}</style>
      <article className="tc-print-root tc-report-page print-work-order fixed inset-0 z-[120] overflow-auto bg-white p-8 text-black print:static print:p-0">
        <header className="flex items-center justify-between border-b-2 border-[#B4432A] pb-4">
          <div className="flex items-center gap-3"><img src="/logo.svg" className="h-12 w-12 object-contain" alt="Trakya Catering" />
            <div><div className="text-xl font-bold">{company?.legal_name ?? 'Trakya Catering'}</div><div className="text-xs text-neutral-600">ÜRETİM İŞ EMRİ · {MEALS[meal] ?? meal}</div></div></div>
          <div className="text-right text-sm"><div className="font-semibold">{dayLabel(date)}</div><div className="text-xs text-neutral-600">Revizyon {workOrder.revision}</div></div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-neutral-300 p-3"><div className="text-xs uppercase text-neutral-500">Toplam kişi</div><div className="mt-1 text-2xl font-bold">{fmtNum(Number(snapshot.kisi ?? 0), 0)}</div></div>
          <div className="rounded-lg border border-neutral-300 p-3"><div className="text-xs uppercase text-neutral-500">Üretim tarihi</div><div className="mt-1 text-lg font-bold">{date}</div></div>
        </section>
        <section className="mt-5"><h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase">Firma dağılımı</h2>
          {firms.length ? <table className="mt-2 w-full text-sm"><thead><tr><th className="py-1 text-left">Firma</th><th className="py-1 text-right">Kişi</th></tr></thead><tbody>{firms.map((firm, i) => <tr key={i} className="border-t border-neutral-200"><td className="py-1">{String(firm.firma ?? '')}</td><td className="py-1 text-right">{fmtNum(Number(firm.kisi ?? 0), 0)}</td></tr>)}</tbody></table> : <p className="mt-2 text-sm text-neutral-500">Firma dağılımı bulunmuyor.</p>}</section>
        <section className="mt-5"><h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase">Yemek hazırlığı</h2>
          {dishes.map((dish, i) => {
            const ingredients = Array.isArray(dish.malzemeler) ? dish.malzemeler as Array<Record<string, Json>> : [];
            const steps = Array.isArray(dish.adimlar) ? dish.adimlar as Array<Record<string, Json>> : [];
            return <div key={i} className="mt-3 break-inside-avoid">
              <div className="flex items-baseline justify-between border-b border-neutral-200 pb-1"><h3 className="font-bold">{String(dish.yemek ?? 'Yemek')}</h3><span className="text-xs text-neutral-600">{fmtNum(Number(dish.porsiyon ?? 0), 0)} porsiyon · {String(dish.kap ?? '')}</span></div>
              {ingredients.length > 0 && <table className="mt-1 w-full text-xs"><thead><tr className="text-neutral-600"><th className="py-1 text-left">Malzeme</th><th className="py-1 text-right">Miktar</th><th className="py-1 text-left">Doğrama / ön işlem</th></tr></thead><tbody>{ingredients.map((ingredient, j) => <tr key={j} className="border-t border-neutral-100"><td className="py-1">{String(ingredient.ad ?? '')}</td><td className="py-1 text-right">{fmtNum(Number(ingredient.miktar ?? 0), 2)} {String(ingredient.birim ?? '')}</td><td className="py-1">{[ingredient.dograma, ingredient.on_islem].filter(Boolean).map(String).join(' · ')}</td></tr>)}</tbody></table>}
              {steps.length > 0 && <ol className="mt-2 list-decimal pl-5 text-xs">{steps.map((step, j) => <li key={j} className="py-0.5">{String(step.adim ?? '')}{step.dk ? ` · ${String(step.dk)} dk` : ''}{step.derece ? ` · ${String(step.derece)}°C` : ''}</li>)}</ol>}
            </div>;
          })}</section>
        <section className="mt-5"><h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase">Toplam malzeme çekme listesi</h2>
          {stock.length ? <table className="mt-2 w-full text-sm"><thead><tr><th className="py-1 text-left">Malzeme</th><th className="py-1 text-right">Miktar</th><th className="py-1 text-center">Teslim</th></tr></thead><tbody>{stock.map((line, i) => <tr key={i} className="border-t border-neutral-200"><td className="py-1">{String(line.ad ?? '')}</td><td className="py-1 text-right">{fmtNum(Number(line.miktar ?? 0), 3)} {String(line.birim ?? '')}</td><td className="py-1 text-center">□</td></tr>)}</tbody></table> : <p className="mt-2 text-sm text-neutral-500">Malzeme çekme listesi boş.</p>}</section>
        <footer className="mt-8 flex justify-between border-t border-neutral-300 pt-3 text-xs text-neutral-600"><span>{company?.report_footer ?? 'Trakya Catering ERP'}</span><span>İş emri {workOrder.id.slice(0, 8)} · Rev. {workOrder.revision}</span></footer>
      </article>
    </>
  );
}
