import { ArrowRight, CheckCircle2, ChefHat, Circle, ClipboardList, Map as MapIcon, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@/app/router';
import { ROADMAP } from '@/app/modules';
import { useCan, useMember } from '@/app/session';
import { addDays, minutesToCutoff, monthKey, monthRange, shortDay, todayISO } from '@/lib/dates';
import { MEALS, PRICE_STALE_DAYS, ROLES } from '@/lib/domain';
import { amountOf } from '@/lib/finance';
import { daysSince, fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { ReportPreview, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import type { MealOrder } from '../sales/api';
import { Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useAccounts, useEntries, useOpenItems } from '../finance/api';
import { useIngredients, useMenuCosts, useRecipeCosts } from '../kitchen/api';
import { usePrepBatches } from '../production/api';
import { orderPeople, useCustomers, useOrders } from '../sales/api';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
}

export function DashboardPage() {
  const member = useMember();
  const isFinance = useCan(ROLES.finance);
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const orders = useOrders(today, tomorrow);
  const prod = usePrepBatches(today);
  const customers = useCustomers();
  const ing = useIngredients();
  const rec = useRecipeCosts();
  const menus = useMenuCosts();
  const { from, to } = monthRange(monthKey(today));
  const entries = useEntries(from, to, isFinance);
  const open = useOpenItems(isFinance);
  const accounts = useAccounts();
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [panelReport, setPanelReport] = useState<ReportSpec | null>(null);

  if (orders.isLoading || prod.isLoading || ing.isLoading || rec.isLoading) return <Loading />;

  const ords = (orders.data ?? []).filter((o) => o.status !== 'iptal');
  const todayOrders = ords.filter((o) => o.service_date === today);
  const tomorrowOrders = ords.filter((o) => o.service_date === tomorrow);
  const peopleToday = todayOrders.reduce((s, o) => s + orderPeople(o), 0);
  const peopleTomorrow = tomorrowOrders.reduce((s, o) => s + orderPeople(o), 0);
  const costToday = (prod.data ?? []).reduce((s, b) => s + Number(b.total_cost ?? 0), 0);
  const custName = (id: string) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '—';
  const cutoff = minutesToCutoff();

  const ingredients = ing.data ?? [];
  const priceIssues = ingredients.filter((i) => i.active && (i.last_price === null || (daysSince(i.price_updated_at) ?? 0) > PRICE_STALE_DAYS));
  const monthRows = entries.data ?? [];
  const inc = monthRows.filter((e) => e.kind === 'gelir').reduce((s, e) => s + amountOf(e), 0);
  const exp = monthRows.filter((e) => e.kind === 'gider').reduce((s, e) => s + amountOf(e), 0);
  const dueSoon = (open.data ?? []).filter((e) => (e.due_date ?? e.entry_date) <= addDays(today, 7));
  const balance = (accounts.data ?? []).reduce((s, a) => s + Number(a.balance ?? 0), 0);

  // ---- Kartların kaynak raporları (rakam hangi kayıtlardan geliyor)
  const ordersSpec = (title: string, day: string, list: MealOrder[]): ReportSpec => ({
    title, subtitle: `${shortDay(day)} · ${list.length} sipariş · kaynak: Siparişler`,
    summary: list.map((o) => ({ label: `${custName(o.customer_id)} · ${MEALS[o.meal]}`, value: `${fmtNum(orderPeople(o), 0)} kişi` })),
    table: { filename: `siparisler-${day}`, header: ['Firma', 'Öğün', 'Kişi', 'Kişi başı ₺', 'Tutar ₺', 'Durum'],
      rows: list.map((o) => [custName(o.customer_id), MEALS[o.meal], orderPeople(o), o.unit_price, orderPeople(o) * Number(o.unit_price), o.status]) },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Toplam kişi', value: fmtNum(list.reduce((t, o) => t + orderPeople(o), 0), 0) }, { label: 'Sipariş', value: list.length },
          { label: 'Tutar (KDV hariç)', value: fmtMoney(list.reduce((t, o) => t + orderPeople(o) * Number(o.unit_price), 0)) }]} />
        <ReportSection title="Firma bazında">
          <table><thead><tr><th>Firma</th><th>Öğün</th><th className="num">Kişi</th><th className="num">Kişi başı</th><th className="num">Tutar</th></tr></thead>
            <tbody>{list.map((o) => <tr key={o.id}><td>{custName(o.customer_id)}</td><td>{MEALS[o.meal]}</td><td className="num">{fmtNum(orderPeople(o), 0)}</td>
              <td className="num">{fmtMoney(o.unit_price)}</td><td className="num">{fmtMoney(orderPeople(o) * Number(o.unit_price))}</td></tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });
  const costSpec = (): ReportSpec => {
    const list = prod.data ?? [];
    return {
      title: 'Bugünkü Hammadde Maliyeti', subtitle: `${shortDay(today)} · kaynak: Günlük Hazırlık kayıtları`,
      summary: list.map((b) => ({ label: b.dish_name ?? '', value: `${fmtMoney(b.total_cost)} (${fmtMoney(b.cost_per_portion)}/porsiyon)` })),
      table: { filename: `hammadde-${today}`, header: ['Öğün', 'Yemek', 'Porsiyon', 'Toplam ₺', 'Porsiyon ₺'],
        rows: list.map((b) => [MEALS[b.meal ?? 'ogle'], b.dish_name, b.portions, b.total_cost, b.cost_per_portion]) },
      body: () => (
        <>
          <ReportStats items={[{ label: 'Toplam', value: fmtMoney(costToday) }, { label: 'Kişi', value: fmtNum(peopleToday, 0) },
            { label: 'Kişi başı', value: peopleToday ? fmtMoney(costToday / peopleToday) : '—' }, { label: 'Yemek', value: list.length }]} />
          <ReportSection title="Yemek bazında (hazırlanan malzeme × birim fiyat)">
            <table><thead><tr><th>Öğün</th><th>Yemek</th><th className="num">Porsiyon</th><th className="num">Toplam</th><th className="num">1 porsiyon</th></tr></thead>
              <tbody>{list.map((b) => <tr key={b.batch_id}><td>{MEALS[b.meal ?? 'ogle']}</td><td>{b.dish_name}</td><td className="num">{fmtNum(b.portions, 0)}</td>
                <td className="num">{fmtMoney(b.total_cost)}</td><td className="num"><b>{fmtMoney(b.cost_per_portion)}</b></td></tr>)}</tbody></table>
          </ReportSection>
        </>
      ),
    };
  };
  const cashSpec = (): ReportSpec => ({
    title: 'Kasa ve Banka Durumu', subtitle: `${shortDay(today)} · kaynak: Kasa hareketleri ve açık kalemler`,
    summary: [...(accounts.data ?? []).map((a) => ({ label: a.name ?? '', value: fmtMoney(a.balance) })), { label: '7 gün içinde vadeli', value: `${dueSoon.length} kalem` }],
    table: { filename: `kasa-${today}`, header: ['Tür', 'Kime / kimden', 'Vade', 'Tutar ₺'],
      rows: dueSoon.map((e) => [e.kind === 'gelir' ? 'Alacak' : 'Borç', e.counterparty ?? e.description, e.due_date ?? e.entry_date, Number(e.net_amount) + Number(e.vat_amount)]) },
    body: () => (
      <>
        <ReportSection title="Hesap bakiyeleri">
          <table><thead><tr><th>Hesap</th><th className="num">Açılış</th><th className="num">Bakiye</th></tr></thead>
            <tbody>{(accounts.data ?? []).map((a) => <tr key={a.id}><td>{a.name}</td><td className="num">{fmtMoney(a.opening_balance)}</td><td className="num"><b>{fmtMoney(a.balance)}</b></td></tr>)}
              <tr><td><b>Toplam</b></td><td /><td className="num"><b>{fmtMoney(balance)}</b></td></tr></tbody></table>
        </ReportSection>
        <ReportSection title="7 gün içinde vadesi gelen alacak ve borçlar">
          {dueSoon.length === 0 ? <div style={{ fontSize: 11 }}>Yok.</div> : (
            <table><thead><tr><th>Tür</th><th>Kime / kimden</th><th>Vade</th><th className="num">Tutar</th></tr></thead>
              <tbody>{dueSoon.map((e) => <tr key={e.id}><td>{e.kind === 'gelir' ? 'Alacak' : 'Borç'}</td><td>{e.counterparty ?? e.description}</td>
                <td>{fmtDate(e.due_date ?? e.entry_date)}</td><td className="num">{fmtMoney(Number(e.net_amount) + Number(e.vat_amount))}</td></tr>)}</tbody></table>
          )}
        </ReportSection>
      </>
    ),
  });
  const entriesSpec = (kind: 'gelir' | 'gider'): ReportSpec => {
    const list = monthRows.filter((e) => e.kind === kind).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    return {
      title: kind === 'gelir' ? 'Bu Ayın Gelirleri' : 'Bu Ayın Giderleri', subtitle: `${from} – ${to} · kaynak: Finans defteri (KDV hariç)`,
      summary: [{ label: 'Toplam', value: fmtMoney(kind === 'gelir' ? inc : exp) }, { label: 'Kayıt', value: String(list.length) }],
      table: { filename: `${kind}-${from}`, header: ['Tarih', 'Kalem', 'Açıklama', 'Kime / kimden', 'Tutar ₺', 'Durum'],
        rows: list.map((e) => [e.entry_date, e.category_code, e.description, e.counterparty, amountOf(e), e.status]) },
      body: () => (
        <ReportSection title={`${list.length} kayıt · toplam ${fmtMoney(kind === 'gelir' ? inc : exp)}`}>
          <table><thead><tr><th>Tarih</th><th>Açıklama</th><th>Kime / kimden</th><th className="num">Tutar</th><th>Durum</th></tr></thead>
            <tbody>{list.map((e) => <tr key={e.id}><td>{shortDay(e.entry_date)}</td><td>{e.description}</td><td>{e.counterparty ?? '—'}</td>
              <td className="num">{fmtMoney(amountOf(e))}</td><td>{e.status === 'odendi' ? (kind === 'gelir' ? 'Tahsil' : 'Ödendi') : 'Bekliyor'}</td></tr>)}</tbody></table>
        </ReportSection>
      ),
    };
  };
  const steps = [
    { done: ingredients.length > 0, label: 'Hammaddeleri ekle', hint: 'birim, fire, alış fiyatı', to: '/hammaddeler' },
    { done: (rec.data ?? []).some((r) => (r.line_count ?? 0) > 0), label: 'Reçete gramajlarını gir', hint: '1 porsiyonun net gramajı', to: '/receteler' },
    { done: (menus.data ?? []).length > 0, label: 'Menüleri kur', hint: 'kaç çeşitse o kadar kap', to: '/menuler' },
    { done: (customers.data ?? []).length > 0, label: 'Müşterileri ekle', hint: 'kişi başı fiyat ve vade', to: '/musteriler' },
    { done: ords.length > 0, label: 'Sipariş gir', hint: 'yarının yemek sayıları', to: '/siparisler' },
  ];
  const setupDone = steps.every((s) => s.done);

  const byMeal = Object.keys(MEALS).map((m) => ({
    m, people: todayOrders.filter((o) => o.meal === m).reduce((s, o) => s + orderPeople(o), 0),
    cost: (prod.data ?? []).filter((b) => b.meal === m).reduce((s, b) => s + Number(b.total_cost ?? 0), 0),
  })).filter((x) => x.people > 0 || x.cost > 0);

  return (
    <>
      <ModuleHero
        kicker={new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${member.fullName.split(' ')[0]}`}
        stats={[
          { label: 'Bugün kişi', value: fmtNum(peopleToday, 0), hint: `${todayOrders.length} sipariş`, source: () => ordersSpec('Bugünün Siparişleri', today, todayOrders) },
          { label: 'Bugünkü hammadde', value: <Money value={costToday} />, hint: peopleToday ? <>kişi başı <Money value={costToday / peopleToday} /></> : 'hazırlık girilmedi', source: costSpec },
          { label: 'Yarın kişi', value: fmtNum(peopleTomorrow, 0), hint: cutoff > 0 ? `kesime ${Math.floor(cutoff / 60)} sa ${cutoff % 60} dk` : 'kesim saati geçti', source: () => ordersSpec('Yarının Siparişleri', tomorrow, tomorrowOrders) },
          isFinance
            ? { label: 'Kasa + banka', value: <Money value={balance} />, tone: balance < 0 ? 'warn' : 'default', hint: `${dueSoon.length} vadeli kalem (7 gün)`, source: cashSpec }
            : { label: 'Fiyat bekleyen', value: priceIssues.length, tone: priceIssues.length ? 'warn' : 'good' },
        ]}
      />

      {!setupDone && (
        <Panel className="mb-4" title="Başlangıç adımları" subtitle="Maliyet hesabının doğru çalışması için sırayla tamamlayın">
          <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link to={s.to} className={cx('flex items-start gap-2.5 rounded-xl p-3 ring-1 h-full', s.done ? 'ring-line bg-surface-2/50' : 'ring-brand/30 bg-brand-soft/40 hover:bg-brand-soft')}>
                  {s.done ? <CheckCircle2 className="w-5 h-5 text-ok shrink-0" /> : <Circle className="w-5 h-5 text-brand shrink-0" />}
                  <div>
                    <div className={cx('text-sm font-semibold', s.done ? 'text-ink-3' : 'text-ink')}>{i + 1}. {s.label}</div>
                    <div className="text-[11px] text-ink-3">{s.hint}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title={<span className="inline-flex items-center gap-2"><ChefHat className="w-4 h-4 text-brand" />Bugün mutfakta</span>}
          action={<Link to="/uretim" className="text-xs font-semibold text-brand">Hazırlık →</Link>}>
          {byMeal.length === 0 ? <p className="text-sm text-ink-3">Bugün için sipariş ya da hazırlık kaydı yok.</p> : (
            <ul className="space-y-3">
              {byMeal.map((x) => (
                <li key={x.m} className="flex items-center justify-between gap-3">
                  <div><div className="text-sm font-semibold text-ink">{MEALS[x.m]}</div><div className="text-[11px] text-ink-3">{fmtNum(x.people, 0)} kişi</div></div>
                  <div className="text-right">
                    <Money value={x.cost} className="text-sm font-semibold" />
                    <div className="text-[11px] text-ink-3">{x.people ? <>kişi başı <Money value={x.cost / x.people} /></> : '—'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={<span className="inline-flex items-center gap-2"><ClipboardList className="w-4 h-4 text-brand" />Yarın · {shortDay(tomorrow)}</span>}
          subtitle={cutoff > 0 ? `Siparişler 16:00’da kesinleşir` : 'Kesim saati geçti — değişiklikler operatörden'}
          action={<Link to="/siparisler" className="text-xs font-semibold text-brand">Siparişler →</Link>}>
          {tomorrowOrders.length === 0 ? <p className="text-sm text-ink-3">Yarın için sipariş girilmedi.</p> : (
            <ul className="divide-y divide-line -my-1.5">
              {tomorrowOrders.slice(0, 7).map((o) => (
                <li key={o.id} className="flex justify-between py-1.5 text-sm">
                  <span className="text-ink-2 truncate">{custName(o.customer_id)} <span className="text-ink-3 text-xs">· {MEALS[o.meal]}</span></span>
                  <span className="tc-num font-semibold text-ink">{fmtNum(orderPeople(o), 0)}</span>
                </li>
              ))}
              {tomorrowOrders.length > 7 && <li className="py-1.5 text-xs text-ink-3">+{tomorrowOrders.length - 7} sipariş</li>}
            </ul>
          )}
        </Panel>

        {isFinance ? (
          <Panel title={<span className="inline-flex items-center gap-2"><Wallet className="w-4 h-4 text-brand" />Bu ay</span>}
            action={<Link to="/finans" className="text-xs font-semibold text-brand">Finans →</Link>}>
            <div className="space-y-2 text-sm">
              <button type="button" onClick={() => setPanelReport(entriesSpec('gelir'))} className="w-full flex justify-between rounded-lg -mx-1 px-1 hover:bg-surface-2"><span className="text-ink-3">Gelir</span><Money value={inc} className="font-semibold text-ok" /></button>
              <button type="button" onClick={() => setPanelReport(entriesSpec('gider'))} className="w-full flex justify-between rounded-lg -mx-1 px-1 hover:bg-surface-2"><span className="text-ink-3">Gider</span><Money value={exp} className="font-semibold" /></button>
              <div className="flex justify-between pt-2 border-t border-line"><span className="font-semibold text-ink">Net</span><Money value={inc - exp} className={cx('font-bold', inc - exp < 0 ? 'text-stop' : 'text-ink')} /></div>
            </div>
            {dueSoon.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">7 gün içinde vadesi gelen</div>
                <ul className="space-y-1">
                  {dueSoon.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex justify-between text-xs">
                      <span className="truncate text-ink-2"><Pill tone={e.kind === 'gelir' ? 'ok' : 'wait'} className="mr-1">{e.kind === 'gelir' ? 'alacak' : 'borç'}</Pill>{e.counterparty ?? e.description}</span>
                      <Money value={Number(e.net_amount) + Number(e.vat_amount)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        ) : (
          <Panel title="Fiyat bekleyen hammaddeler" action={<Link to="/hammaddeler" className="text-xs font-semibold text-brand">Tümü →</Link>}>
            {priceIssues.length === 0 ? <p className="text-sm text-ink-3">Tüm fiyatlar güncel.</p> : (
              <ul className="divide-y divide-line -my-1.5">
                {priceIssues.slice(0, 7).map((i) => (
                  <li key={i.id} className="flex justify-between py-1.5 text-sm"><span className="truncate">{i.name}</span>{i.last_price === null ? <Pill tone="wait">yok</Pill> : <span className="text-xs text-wait">eski</span>}</li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {isFinance && priceIssues.length > 0 && (
        <p className="text-xs text-ink-3 mt-4">
          {priceIssues.length} hammaddenin fiyatı yok veya {PRICE_STALE_DAYS} günden eski — maliyetler yanıltıcı olabilir. <Link to="/hammaddeler" className="text-brand font-semibold">Güncelle →</Link>
        </p>
      )}

      {panelReport && <ReportPreview spec={panelReport} onClose={() => setPanelReport(null)} />}

      {(member.role === 'yonetici' || member.role === 'kurucu') && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowRoadmap(!showRoadmap)} className="inline-flex items-center gap-2 text-xs font-semibold text-ink-3 hover:text-ink">
            <MapIcon className="w-4 h-4" /> Yol haritası {showRoadmap ? '▴' : '▾'}
          </button>
          {showRoadmap && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
              {ROADMAP.map((r) => (
                <div key={r.label} className="rounded-xl ring-1 ring-line bg-card px-3 py-2.5">
                  <div className="text-sm font-semibold text-ink">{r.label}</div>
                  <div className="text-[11px] text-ink-3">{r.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function NotFound() {
  return (
    <>
      <ModuleHero kicker="404" title="Sayfa bulunamadı" description="Aradığınız ekran yok ya da görme yetkiniz yok." />
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Bugün ekranına dön <ArrowRight className="w-4 h-4" /></Link>
    </>
  );
}
