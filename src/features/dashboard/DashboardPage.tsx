import { ArrowRight, CheckCircle2, ChefHat, Circle, ClipboardList, Map as MapIcon, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@/app/router';
import { ROADMAP } from '@/app/modules';
import { useCan, useMember } from '@/app/session';
import { addDays, minutesToCutoff, monthKey, monthRange, shortDay, todayISO } from '@/lib/dates';
import { MEALS, PRICE_STALE_DAYS, ROLES } from '@/lib/domain';
import { amountOf } from '@/lib/finance';
import { daysSince, fmtNum } from '@/lib/format';
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
          { label: 'Bugün kişi', value: fmtNum(peopleToday, 0), hint: `${todayOrders.length} sipariş` },
          { label: 'Bugünkü hammadde', value: <Money value={costToday} />, hint: peopleToday ? <>kişi başı <Money value={costToday / peopleToday} /></> : 'hazırlık girilmedi' },
          { label: 'Yarın kişi', value: fmtNum(peopleTomorrow, 0), hint: cutoff > 0 ? `kesime ${Math.floor(cutoff / 60)} sa ${cutoff % 60} dk` : 'kesim saati geçti' },
          isFinance
            ? { label: 'Kasa + banka', value: <Money value={balance} />, tone: balance < 0 ? 'warn' : 'default', hint: `${dueSoon.length} ödeme/tahsilat 7 gün içinde` }
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
              <div className="flex justify-between"><span className="text-ink-3">Gelir</span><Money value={inc} className="font-semibold text-ok" /></div>
              <div className="flex justify-between"><span className="text-ink-3">Gider</span><Money value={exp} className="font-semibold" /></div>
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

      {member.role === 'yonetici' && (
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
