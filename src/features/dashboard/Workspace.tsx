import { useState, type ReactNode } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { usePermissionMaps } from '@/app/permissions';
import { Link } from '@/app/router';
import { useMember } from '@/app/session';
import { hasManagerHome, workspaceCards, type CardDef, type CardId } from '@/app/workspaces';
import { useRows } from '@/lib/crud';
import { addDays, shortDay, todayISO } from '@/lib/dates';
import { MEALS, PRICE_STALE_DAYS, ROLE_LABELS } from '@/lib/domain';
import { daysSince, fmtMoney, fmtNum } from '@/lib/format';
import { stockLevels } from '@/lib/stock';
import { ModuleHero, Panel, Tabs, cx } from '@/ui/primitives';
import { ApprovalsPanel, usePendingApprovalCount } from '../approvals/ApprovalsPanel';
import { APPROVAL_STATUS, useApprovals } from '../approvals/api';
import { useAlerts } from '../assistant/Notifications';
import { useInvoices, useOpenItems } from '../finance/api';
import { useIngredients } from '../kitchen/api';
import { REQUEST_KINDS } from '../people/api';
import { useMenuPlans, usePrepBatches } from '../production/api';
import { orderPeople, useCustomers, useOrders } from '../sales/api';
import { useStockMoves } from '../stock/StockPage';
import { DashboardPage } from './DashboardPage';

/** Bugün: yönetici/kurucu için Özet · Onaylar; diğer roller için kendi iş masası. */
export function HomePage() {
  const me = useMember();
  return hasManagerHome(me.role) ? <ManagerHome /> : <Workspace />;
}

function ManagerHome() {
  const [tab, setTab] = useState<'ozet' | 'onaylar'>('ozet');
  const pending = usePendingApprovalCount();
  return (
    <>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[
        { id: 'ozet', label: 'Özet' }, { id: 'onaylar', label: 'Onaylar', count: pending },
      ]} /></div>
      {tab === 'ozet' ? <DashboardPage /> : <ApprovalsPanel />}
    </>
  );
}

// ---------------------------------------------------------------------------- Rol iş masası

function Workspace() {
  const me = useMember();
  const perms = usePermissionMaps();
  const cards = workspaceCards(me.role, perms);
  const alerts = useAlerts().alerts.slice(0, 5);
  return (
    <>
      <ModuleHero kicker={`Bugün · ${ROLE_LABELS[me.role]}`} title={`Merhaba ${me.fullName.split(' ')[0]}`}
        description="İşinize dair bugünün özeti. Karta dokununca ilgili ekran açılır; girdiğiniz her kayıt ana modüle yazılır." />
      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
          {cards.map((c) => <WorkspaceCard key={c.id} def={c} />)}
        </div>
      )}
      <Panel title="Asistan" subtitle="Dikkat edilmesi gerekenler">
        {alerts.length === 0 ? <p className="text-sm text-ink-3">Şu an dikkat gerektiren bir şey yok.</p> : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link to={a.to} className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
                  <Sparkles className={cx('w-4 h-4 mt-0.5 shrink-0', a.tone === 'stop' ? 'text-stop' : a.tone === 'wait' ? 'text-wait' : 'text-info')} />
                  <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{a.title}</span><span className="block text-xs text-ink-3">{a.body}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function CardShell({ def, value, lines, tone = 'default', loading }: {
  def: CardDef; value: ReactNode; lines?: string[]; tone?: 'default' | 'warn' | 'good'; loading?: boolean;
}) {
  const body = (
    <div className={cx('tc-card p-4 h-full transition', def.to && 'hover:ring-brand/40 hover:-translate-y-0.5')}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-semibold text-ink-3">{def.title}</div>
        {def.to && <ArrowRight className="w-4 h-4 text-ink-3 shrink-0" aria-hidden />}
      </div>
      <div className={cx('mt-1 font-display text-2xl font-extrabold tc-num', tone === 'warn' ? 'text-stop' : tone === 'good' ? 'text-ok' : 'text-ink')}>
        {loading ? '…' : value}
      </div>
      {!loading && lines && lines.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-ink-2">
          {lines.slice(0, 4).map((l, i) => <li key={i} className="truncate">{l}</li>)}
          {lines.length > 4 && <li className="text-ink-3">+{lines.length - 4} daha</li>}
        </ul>
      )}
    </div>
  );
  return def.to ? <Link to={def.to} className="block">{body}</Link> : body;
}

const CARD_VIEWS: Record<CardId, (p: { def: CardDef }) => ReactNode> = {
  yarin_uretim: TomorrowProduction,
  bugun_recetesiz: ({ def }) => <PrepCard def={def} pick={(b) => !b.recipe_id} empty="Hepsinin reçetesi var" />,
  bugun_fiyatsiz_malzeme: ({ def }) => <PrepCard def={def} pick={(b) => (b.item_count ?? 0) === 0 || (b.missing_price_count ?? 0) > 0} empty="Tüm yemeklerin malzemesi tam" />,
  menu_plani_bos: EmptyMenuDays,
  kritik_stok: CriticalStock,
  bugun_stok_cikis: TodayStockMoves,
  bugun_sevk: TodaySupplies,
  acik_satinalma: OpenPurchaseOrders,
  eski_fiyat: StalePrices,
  vadesi_gelen: DueSoon,
  taslak_fatura: DraftInvoices,
  bekleyen_talep: PendingRequests,
  fiyatsiz_siparis: UnpricedOrders,
  siparis_girmeyen: MissingOrders,
  aktif_musteri: ActiveCustomers,
  bugun_teslim: TodayDeliveries,
  taleplerim: MyRequests,
};

function WorkspaceCard({ def }: { def: CardDef }) {
  const View = CARD_VIEWS[def.id];
  return <View def={def} />;
}

// ---- Kart verileri (her kart kendi kaydını okur; yalnız gösterilen kartlar sorgu yapar)

function TomorrowProduction({ def }: { def: CardDef }) {
  const tomorrow = addDays(todayISO(), 1);
  const orders = useOrders(tomorrow);
  const list = (orders.data ?? []).filter((o) => o.status !== 'iptal');
  const byMeal = new Map<string, number>();
  for (const o of list) byMeal.set(o.meal, (byMeal.get(o.meal) ?? 0) + orderPeople(o));
  const total = [...byMeal.values()].reduce((s, n) => s + n, 0);
  return <CardShell def={def} loading={orders.isLoading} value={`${fmtNum(total, 0)} kişi`}
    lines={[...byMeal.entries()].map(([m, n]) => `${MEALS[m] ?? m}: ${fmtNum(n, 0)} kişi`)} />;
}

function PrepCard({ def, pick, empty }: { def: CardDef; pick: (b: { recipe_id: string | null; item_count: number | null; missing_price_count: number | null }) => boolean; empty: string }) {
  const batches = usePrepBatches(todayISO());
  const hit = (batches.data ?? []).filter(pick);
  return <CardShell def={def} loading={batches.isLoading} value={hit.length} tone={hit.length ? 'warn' : 'good'}
    lines={hit.length ? hit.map((b) => `${b.dish_name ?? ''} · ${MEALS[b.meal ?? 'ogle']}`) : [empty]} />;
}

function EmptyMenuDays({ def }: { def: CardDef }) {
  const from = addDays(todayISO(), 1); const to = addDays(from, 6);
  const plans = useMenuPlans(from, to);
  const planned = new Set((plans.data ?? []).map((p) => p.plan_date));
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i)).filter((d) => !planned.has(d));
  return <CardShell def={def} loading={plans.isLoading} value={`${days.length} gün`} tone={days.length ? 'warn' : 'good'}
    lines={days.length ? days.map((d) => shortDay(d)) : ['Önümüzdeki 7 gün planlı']} />;
}

function CriticalStock({ def }: { def: CardDef }) {
  const ings = useIngredients();
  const moves = useStockMoves();
  const levels = stockLevels((moves.data ?? []).map((m) => ({ ...m, qty: Number(m.qty) })));
  const low = (ings.data ?? []).filter((i) => i.active && Number(i.min_stock) > 0 && (levels.get(i.id) ?? 0) < Number(i.min_stock));
  return <CardShell def={def} loading={ings.isLoading || moves.isLoading} value={low.length} tone={low.length ? 'warn' : 'good'}
    lines={low.length ? low.map((i) => `${i.name}: ${fmtNum(levels.get(i.id) ?? 0, 1)} / ${fmtNum(Number(i.min_stock), 1)} ${i.stock_unit}`) : ['En az stok seviyesinin altında kalem yok']} />;
}

function TodayStockMoves({ def }: { def: CardDef }) {
  const today = todayISO();
  const moves = useStockMoves(today);
  const list = (moves.data ?? []).filter((m) => m.move_date === today);
  const inCount = list.filter((m) => Number(m.qty) > 0).length;
  return <CardShell def={def} loading={moves.isLoading} value={list.length}
    lines={[`${inCount} giriş · ${list.length - inCount} çıkış`]} />;
}

function TodaySupplies({ def }: { def: CardDef }) {
  const today = todayISO();
  const moves = useRows('stock_movements', { key: ['sevk-bugun', today], filter: (q) => q.eq('source', 'sevk').eq('move_date', today) });
  const customers = useCustomers();
  const firms = new Set((moves.data ?? []).map((m) => m.customer_id));
  const name = (id: string | null) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '—';
  return <CardShell def={def} loading={moves.isLoading} value={`${(moves.data ?? []).length} kalem`}
    lines={[...firms].map((f) => name(f))} />;
}

function OpenPurchaseOrders({ def }: { def: CardDef }) {
  const pos = useRows('purchase_orders', { key: ['acik'], filter: (q) => q.in('status', ['taslak', 'verildi']) });
  const list = pos.data ?? [];
  return <CardShell def={def} loading={pos.isLoading} value={list.length}
    lines={[`${list.filter((p) => p.status === 'taslak').length} taslak · ${list.filter((p) => p.status === 'verildi').length} verildi`, `Toplam ${fmtMoney(list.reduce((s, p) => s + Number(p.total), 0))}`]} />;
}

function StalePrices({ def }: { def: CardDef }) {
  const ings = useIngredients();
  const stale = (ings.data ?? []).filter((i) => i.active && (i.last_price === null || (daysSince(i.price_updated_at) ?? 0) > PRICE_STALE_DAYS));
  return <CardShell def={def} loading={ings.isLoading} value={stale.length} tone={stale.length ? 'warn' : 'good'}
    lines={stale.map((i) => `${i.name}${i.last_price === null ? ' (fiyat yok)' : ''}`)} />;
}

function DueSoon({ def }: { def: CardDef }) {
  const open = useOpenItems(true);
  const limit = addDays(todayISO(), 7);
  const due = (open.data ?? []).filter((e) => (e.due_date ?? e.entry_date) <= limit);
  const sum = (k: string) => due.filter((e) => e.kind === k).reduce((s, e) => s + Number(e.net_amount) + Number(e.vat_amount), 0);
  return <CardShell def={def} loading={open.isLoading} value={due.length}
    lines={[`Tahsil edilecek ${fmtMoney(sum('gelir'))}`, `Ödenecek ${fmtMoney(sum('gider'))}`]} />;
}

function DraftInvoices({ def }: { def: CardDef }) {
  const today = todayISO();
  const inv = useInvoices(addDays(today, -60), today);
  const drafts = (inv.data ?? []).filter((i) => i.status === 'taslak');
  return <CardShell def={def} loading={inv.isLoading} value={drafts.length} tone={drafts.length ? 'warn' : 'good'}
    lines={drafts.map((i) => `${i.supplier_name} · ${fmtMoney(i.total_amount)}`)} />;
}

function PendingRequests({ def }: { def: CardDef }) {
  const req = useRows('employee_requests', { key: ['bekleyen'], filter: (q) => q.eq('status', 'bekliyor') });
  const list = req.data ?? [];
  return <CardShell def={def} loading={req.isLoading} value={list.length}
    lines={Object.entries(REQUEST_KINDS).map(([k, l]) => `${l}: ${list.filter((r) => r.kind === k).length}`)} />;
}

function UnpricedOrders({ def }: { def: CardDef }) {
  const today = todayISO();
  const orders = useOrders(today, addDays(today, 7));
  const customers = useCustomers();
  const hit = (orders.data ?? []).filter((o) => o.status !== 'iptal' && o.ordered_qty > 0 && !(Number(o.unit_price) > 0));
  const name = (id: string) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '—';
  return <CardShell def={def} loading={orders.isLoading} value={hit.length} tone={hit.length ? 'warn' : 'good'}
    lines={hit.map((o) => `${name(o.customer_id)} · ${shortDay(o.service_date)}`)} />;
}

function MissingOrders({ def }: { def: CardDef }) {
  const tomorrow = addDays(todayISO(), 1);
  const orders = useOrders(tomorrow);
  const customers = useCustomers();
  const has = new Set((orders.data ?? []).filter((o) => o.status !== 'iptal').map((o) => o.customer_id));
  const missing = (customers.data ?? []).filter((c) => c.active && !has.has(c.id));
  return <CardShell def={def} loading={orders.isLoading || customers.isLoading} value={missing.length} tone={missing.length ? 'warn' : 'good'}
    lines={missing.map((c) => c.name)} />;
}

function ActiveCustomers({ def }: { def: CardDef }) {
  const customers = useCustomers();
  const active = (customers.data ?? []).filter((c) => c.active);
  return <CardShell def={def} loading={customers.isLoading} value={active.length} lines={active.map((c) => c.name)} />;
}

function MyRequests({ def }: { def: CardDef }) {
  const me = useMember();
  const list = (useApprovals().data ?? []).filter((a) => a.requested_by === me.userId || a.entered_by === me.userId);
  const open = list.filter((a) => a.status === 'bekliyor').length;
  return <CardShell def={def} value={`${open} bekliyor`}
    lines={list.slice(0, 4).map((a) => `${a.title} · ${APPROVAL_STATUS[a.status].label}`)} />;
}

function TodayDeliveries({ def }: { def: CardDef }) {
  const orders = useOrders(todayISO());
  const customers = useCustomers();
  const list = (orders.data ?? []).filter((o) => o.status !== 'iptal');
  const name = (id: string) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '—';
  return <CardShell def={def} loading={orders.isLoading} value={`${list.length} teslim`}
    lines={list.map((o) => `${name(o.customer_id)} · ${MEALS[o.meal]} · ${fmtNum(orderPeople(o), 0)} kişi${o.status === 'teslim_edildi' ? ' ✓' : ''}`)} />;
}

