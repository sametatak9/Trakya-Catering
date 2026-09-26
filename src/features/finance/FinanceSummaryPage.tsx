import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Link } from '@/app/router';
import { lastMonths, monthKey, monthLabel, monthRange, todayISO, addMonths } from '@/lib/dates';
import { amountOf, monthlyTotals, perPersonBreakdown } from '@/lib/finance';
import { fmtNum, fmtPct } from '@/lib/format';
import { Delta, Hint, Meter, MonthNav } from '@/ui/bits';
import { ErrorNote, Loading, ModuleHero, Money, Panel, cx } from '@/ui/primitives';
import { useProduction } from '../production/api';
import { orderPeople, useOrders } from '../sales/api';
import { useEntries, useFinanceCategories } from './api';

const FOOD = 'gida_hammadde';
const GROUP_COLORS = ['bg-brand', 'bg-accent', 'bg-ok', 'bg-info', 'bg-wait', 'bg-ink-3', 'bg-stop'];

export function FinanceSummaryPage() {
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const months = lastMonths(month, 12);
  const entries = useEntries(monthRange(months[0]).from, monthRange(month).to);
  const cats = useFinanceCategories();
  const { from, to } = monthRange(month);
  const prod = useProduction(from, to);
  const orders = useOrders(from, to);

  const rows = entries.data ?? [];
  const income = useMemo(() => monthlyTotals(rows, 'gelir'), [rows]);
  const expense = useMemo(() => monthlyTotals(rows, 'gider'), [rows]);
  const prev = addMonths(month, -1);
  const inc = income[month] ?? 0, exp = expense[month] ?? 0, profit = inc - exp;
  const incP = income[prev] ?? 0, expP = expense[prev] ?? 0, profitP = incP - expP;
  const pct = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

  const people = (orders.data ?? []).filter((o) => o.status !== 'iptal').reduce((s, o) => s + orderPeople(o), 0);
  const theoreticalFood = (prod.data ?? []).reduce((s, l) => s + Number(l.portions) * Number(l.unit_cost), 0);
  const monthRows = rows.filter((r) => monthKey(r.entry_date) === month);
  const actualFood = monthRows.filter((r) => r.kind === 'gider' && r.category_code === FOOD).reduce((s, r) => s + amountOf(r), 0);
  const groupOf = (code: string) => (cats.data ?? []).find((c) => c.code === code)?.group_name ?? 'Diğer';

  // Kişi başı maliyet: hammadde reçeteden (teorik) — yoksa faturadan — + diğer giderler grup grup
  const groupTotals: Record<string, number> = {};
  groupTotals['Hammadde'] = theoreticalFood > 0 ? theoreticalFood : actualFood;
  for (const r of monthRows) {
    if (r.kind !== 'gider' || r.category_code === FOOD) continue;
    const g = groupOf(r.category_code) === 'Mutfak' ? 'Sarf & ambalaj' : groupOf(r.category_code);
    groupTotals[g] = (groupTotals[g] ?? 0) + amountOf(r);
  }
  const breakdown = perPersonBreakdown(groupTotals, people);
  const costPP = breakdown.reduce((s, b) => s + b.perPerson, 0);
  const pricePP = people > 0 ? inc / people : null;

  const expByGroup = Object.entries(monthRows.filter((r) => r.kind === 'gider').reduce<Record<string, number>>((acc, r) => {
    const g = groupOf(r.category_code); acc[g] = (acc[g] ?? 0) + amountOf(r); return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const maxBar = Math.max(1, ...months.map((m) => Math.max(income[m] ?? 0, expense[m] ?? 0)));

  if (entries.isLoading) return <Loading />;
  if (entries.error) return <ErrorNote>Finans verileri yüklenemedi.</ErrorNote>;

  return (
    <>
      <ModuleHero
        kicker="Finans · Yönetim ekranı"
        title="Finans Özeti"
        description="Gelir, gider ve net kâr; 1 kişilik öğünün gerçek maliyeti. Tutarlar KDV hariçtir ve tahakkuk esasına göredir (teslim edilen sipariş = gelir, onaylanan fatura = gider)."
        actions={<MonthNav value={month} onChange={setMonth} />}
        stats={[
          { label: 'Gelir', value: <Money value={inc} />, hint: <Delta pct={pct(inc, incP)} delta={inc - incP} goodWhen="up" /> },
          { label: 'Gider', value: <Money value={exp} />, hint: <Delta pct={pct(exp, expP)} delta={exp - expP} goodWhen="down" /> },
          { label: 'Net kâr', value: <Money value={profit} />, tone: profit < 0 ? 'warn' : profit > 0 ? 'good' : 'default', hint: <Delta pct={pct(profit, profitP)} delta={profit - profitP} goodWhen="up" /> },
          { label: 'Kâr marjı', value: inc > 0 ? fmtPct((profit / inc) * 100) : '—', hint: `${fmtNum(people, 0)} kişi` },
        ]}
      />

      {rows.length === 0 && (
        <div className="mb-4"><Hint>Henüz finans kaydı yok. Siparişleri “teslim edildi” yaptığınızda gelir, gelen faturaları onayladığınızda gider oluşur; faturasız kalemleri Giderler ve Kasa ekranlarından ekleyebilirsiniz.</Hint></div>
      )}

      <div className="grid xl:grid-cols-[1.25fr_1fr] gap-4">
        <Panel title="1 kişilik öğün neye mal oluyor?" subtitle={`${monthLabel(month)} · ${fmtNum(people, 0)} kişi`}>
          {people === 0 ? <p className="text-sm text-ink-3">Bu ay sipariş (kişi sayısı) yok; kişi başı hesap için siparişler gerekli.</p> : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-2xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">Kişi başı maliyet</div><Money value={costPP} className="text-lg font-bold text-ink" /></div>
                <div className="rounded-2xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">Kişi başı satış</div><Money value={pricePP} className="text-lg font-bold text-ink" /></div>
                <div className="rounded-2xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">Kişi başı kâr</div>
                  <Money value={pricePP === null ? null : pricePP - costPP} className={cx('text-lg font-bold', pricePP !== null && pricePP - costPP < 0 ? 'text-stop' : 'text-ok')} /></div>
              </div>
              <div className="flex h-4 rounded-full overflow-hidden mb-4" aria-hidden="true">
                {breakdown.map((b, i) => <div key={b.group} className={GROUP_COLORS[i % GROUP_COLORS.length]} style={{ width: `${b.share}%` }} title={b.group} />)}
              </div>
              <ul className="space-y-2">
                {breakdown.map((b, i) => (
                  <li key={b.group} className="flex items-center gap-3 text-sm">
                    <span className={cx('w-2.5 h-2.5 rounded-full shrink-0', GROUP_COLORS[i % GROUP_COLORS.length])} />
                    <span className="flex-1 text-ink-2">{b.group}{b.group === 'Hammadde' && theoreticalFood > 0 && <span className="text-[11px] text-ink-3"> (reçeteye göre)</span>}</span>
                    <span className="text-xs text-ink-3 tc-num w-12 text-right">%{fmtNum(b.share, 0)}</span>
                    <Money value={b.perPerson} className="font-semibold text-ink w-24 text-right" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Hammadde kontrolü" subtitle="Reçeteye göre harcanması gereken ile faturalardaki gıda alımı">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-ink-2">Reçeteye göre (üretim kayıtları)</span><Money value={theoreticalFood} className="font-semibold" /></div>
              <Meter value={theoreticalFood} max={Math.max(theoreticalFood, actualFood)} tone="ok" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-ink-2">Faturalardaki gıda alımı</span><Money value={actualFood} className="font-semibold" /></div>
              <Meter value={actualFood} max={Math.max(theoreticalFood, actualFood)} tone="brand" />
            </div>
            {theoreticalFood > 0 && actualFood > 0 ? (() => {
              const diffPct = ((actualFood - theoreticalFood) / theoreticalFood) * 100;
              const tone = diffPct > 5 ? 'bg-stop-soft text-stop' : diffPct < -5 ? 'bg-wait-soft text-wait' : 'bg-ok-soft text-ok';
              const msg = diffPct > 5 ? 'Reçetenin gerektirdiğinden fazla alım: fire, gramaj aşımı, kayıp veya stok birikmesi olabilir.'
                : diffPct < -5 ? 'Alım reçetenin gerektirdiğinden az: faturası girilmemiş alımlar olabilir ya da stoktan kullanıldı.'
                : 'Alım reçeteyle uyumlu (±%5).';
              return (
                <div className={cx('rounded-xl px-3 py-2.5 text-sm', tone)}>
                  Fark <b><Money value={actualFood - theoreticalFood} /></b> ({fmtPct(diffPct)}). {msg}
                </div>
              );
            })() : (
              <p className="text-xs text-ink-3 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />Karşılaştırma için hem <Link to="/uretim" className="text-brand font-semibold">günlük üretim</Link> hem de gıda faturaları gerekir.</p>
            )}
          </div>
        </Panel>

        <Panel title="Son 12 ay" subtitle="Gelir ve gider (KDV hariç)" className="xl:col-span-2">
          <div className="flex items-end gap-2 h-48 overflow-x-auto tc-scroll pb-1">
            {months.map((m) => {
              const i = income[m] ?? 0, e = expense[m] ?? 0;
              return (
                <button key={m} type="button" onClick={() => setMonth(m)} className="flex-1 min-w-[42px] h-full flex flex-col justify-end items-center group"
                  title={`${monthLabel(m)} · gelir ${fmtNum(i, 0)} ₺ · gider ${fmtNum(e, 0)} ₺`}>
                  <div className="flex items-end gap-0.5 w-full h-full">
                    <div className="flex-1 rounded-t bg-ok/80 group-hover:bg-ok" style={{ height: `${(i / maxBar) * 100}%` }} />
                    <div className="flex-1 rounded-t bg-brand/80 group-hover:bg-brand" style={{ height: `${(e / maxBar) * 100}%` }} />
                  </div>
                  <div className={cx('text-[10px] mt-1', m === month ? 'text-ink font-bold' : 'text-ink-3')}>{monthLabel(m, true)}</div>
                  <div className={cx('text-[9px] tc-num', i - e < 0 ? 'text-stop' : 'text-ok')}>{i || e ? fmtNum((i - e) / 1000, 0) + 'b' : ''}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 text-[11px] text-ink-3 mt-2">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-ok" />Gelir</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-brand" />Gider</span>
            <span>Alt satır: net (bin ₺)</span>
          </div>
        </Panel>

        <Panel title="Gider dağılımı" subtitle={monthLabel(month)} className="xl:col-span-2"
          action={<Link to="/giderler" className="text-xs font-semibold text-brand">Giderler →</Link>}>
          {expByGroup.length === 0 ? <p className="text-sm text-ink-3">Bu ay gider kaydı yok.</p> : (
            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-3">
              {expByGroup.map(([g, v]) => (
                <li key={g}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-ink-2">{g}</span>
                    <span><Money value={v} className="font-semibold" /> <span className="text-[11px] text-ink-3 tc-num">%{fmtNum((v / exp) * 100, 0)}</span></span></div>
                  <Meter value={v} max={exp} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
