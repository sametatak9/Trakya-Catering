import { useMemo, useState } from 'react';
import { ChefHat, ListRestart, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from '@/app/router';
import { useCan } from '@/app/session';
import { addDays, shortDay, todayISO } from '@/lib/dates';
import { MEALS, ROLES } from '@/lib/domain';
import { amountOf } from '@/lib/finance';
import { fmtNum, parseNum } from '@/lib/format';
import { DateNav, Delta, Hint, SparkBars } from '@/ui/bits';
import { NumCell } from '@/ui/NumCell';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Money, Panel, Pill, Tabs } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useFinanceCategories, useEntries } from '../finance/api';
import { useMenuCosts, useRecipeCosts } from '../kitchen/api';
import { orderPeople, useOrders } from '../sales/api';
import { useAddProduction, useDeleteProduction, usePlanFromOrders, useProduction, useRefreshCosts, useUpdateProduction } from './api';

const TREND_DAYS = 14;

export function ProductionPage() {
  const toast = useToast();
  const canEdit = useCan(ROLES.production);
  const isFinance = useCan(ROLES.finance);
  const [date, setDate] = useState(todayISO);
  const [meal, setMeal] = useState('ogle');
  const from = addDays(date, -(TREND_DAYS - 1));
  const prod = useProduction(from, date);
  const orders = useOrders(from, date);
  const recipes = useRecipeCosts();
  const menus = useMenuCosts();
  // Genel gider payı: son 30 günün hammadde dışı giderleri / son 30 günün kişi sayısı
  const ohFrom = addDays(date, -29);
  const ohEntries = useEntries(ohFrom, date, isFinance);
  const ohOrders = useOrders(ohFrom, date);
  const cats = useFinanceCategories();

  const plan = usePlanFromOrders();
  const refresh = useRefreshCosts();
  const add = useAddProduction();
  const upd = useUpdateProduction();
  const del = useDeleteProduction();

  const recipeById = useMemo(() => new Map((recipes.data ?? []).map((r) => [r.recipe_id!, r])), [recipes.data]);
  const logs = prod.data ?? [];
  const rows = logs.filter((l) => l.prod_date === date && l.meal === meal);
  const dayOrders = (orders.data ?? []).filter((o) => o.service_date === date && o.status !== 'iptal');
  const mealOrders = dayOrders.filter((o) => o.meal === meal);
  const people = mealOrders.reduce((s, o) => s + orderPeople(o), 0);
  const total = rows.reduce((s, l) => s + Number(l.portions) * Number(l.unit_cost), 0);
  const perPerson = people > 0 ? total / people : null;

  // Günlük seri (tüm öğünler): kişi başı hammadde maliyeti
  const days = Array.from({ length: TREND_DAYS }, (_, i) => addDays(from, i));
  const series = days.map((d) => {
    const cost = logs.filter((l) => l.prod_date === d).reduce((s, l) => s + Number(l.portions) * Number(l.unit_cost), 0);
    const ppl = (orders.data ?? []).filter((o) => o.service_date === d && o.status !== 'iptal').reduce((s, o) => s + orderPeople(o), 0);
    return { d, cost, ppl, pp: ppl > 0 ? cost / ppl : 0 };
  });
  const today = series[series.length - 1];
  const prevDay = [...series.slice(0, -1)].reverse().find((x) => x.pp > 0);

  const foodCodes = new Set((cats.data ?? []).filter((c) => c.code === 'gida_hammadde').map((c) => c.code));
  const overhead = (ohEntries.data ?? []).filter((e) => e.kind === 'gider' && !foodCodes.has(e.category_code)).reduce((s, e) => s + amountOf(e), 0);
  const ohPeople = (ohOrders.data ?? []).filter((o) => o.status !== 'iptal').reduce((s, o) => s + orderPeople(o), 0);
  const overheadPP = isFinance && ohPeople > 0 ? overhead / ohPeople : null;

  // Menü bazında: bu öğünde hangi menüden kaç kişi, güncel menü maliyeti
  const byMenu = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of mealOrders) if (o.menu_id) m.set(o.menu_id, (m.get(o.menu_id) ?? 0) + orderPeople(o));
    return [...m.entries()].map(([id, ppl]) => ({ menu: (menus.data ?? []).find((x) => x.menu_id === id), ppl }));
  }, [mealOrders, menus.data]);

  const [nr, setNr] = useState('');
  const [np, setNp] = useState('');
  const addRow = async () => {
    const p = parseNum(np);
    if (!nr) return toast.error('Yemek seçin');
    if (p === null || p <= 0) return toast.error('Porsiyon sayısı girin');
    try { await add.mutateAsync({ prod_date: date, meal, recipe_id: nr, portions: p }); setNr(''); setNp(''); toast.ok('Eklendi'); }
    catch (e) { toast.error(e); }
  };
  const planFromOrders = async () => {
    try {
      const n = await plan.mutateAsync({ date, meal });
      toast.ok(n > 0 ? `${n} yemek siparişlerden hesaplandı` : 'Menüsü seçilmiş sipariş bulunamadı');
    } catch (e) { toast.error(e); }
  };

  return (
    <>
      <ModuleHero
        kicker="Mutfak · Günlük maliyet"
        title="Günlük Üretim & Maliyet"
        description="O gün hangi yemekten kaç porsiyon çıktı ve kaça mal oldu. Maliyet kayıt anındaki alış fiyatlarıyla sabitlenir; sonraki zamlar geçmiş günleri bozmaz."
        stats={[
          { label: `${MEALS[meal]} · kişi`, value: fmtNum(people, 0), hint: people ? `${mealOrders.length} sipariş` : 'sipariş yok' },
          { label: 'Hammadde maliyeti', value: <Money value={total} />, hint: `${rows.length} yemek` },
          { label: 'Kişi başı hammadde', value: perPerson === null ? '—' : <Money value={perPerson} />,
            hint: today.pp > 0 && prevDay ? <Delta pct={((today.pp - prevDay.pp) / prevDay.pp) * 100} delta={today.pp - prevDay.pp} goodWhen="down" /> : 'önceki günle kıyas' },
          isFinance
            ? { label: 'Kişi başı tam maliyet', value: perPerson === null || overheadPP === null ? '—' : <Money value={perPerson + overheadPP} />,
                hint: overheadPP === null ? 'gider kaydı yok' : <>+ genel gider payı <Money value={overheadPP} /></> }
            : { label: 'Porsiyon', value: fmtNum(rows.reduce((s, l) => s + Number(l.portions), 0), 0) },
        ]}
      />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
        <DateNav value={date} onChange={setDate} />
        <Tabs value={meal} onChange={setMeal} items={Object.entries(MEALS).map(([id, label]) => ({
          id, label, count: logs.filter((l) => l.prod_date === date && l.meal === id).length || undefined,
        }))} />
      </div>

      {(recipes.data ?? []).length === 0 && !recipes.isLoading && (
        <div className="mb-4"><Hint action={<Link to="/receteler" className="text-sm font-semibold text-brand whitespace-nowrap">Reçete oluştur →</Link>}>
          Günlük maliyet reçetelerden hesaplanır. Önce hammaddeleri ve reçete gramajlarını girin.
        </Hint></div>
      )}

      <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
        <Panel pad={false} title={`${MEALS[meal]} üretimi`}
          subtitle="Siparişlerden otomatik hesaplayın veya elle ekleyin; porsiyonu değiştirmek için sayıya tıklayın"
          action={canEdit && (
            <div className="flex gap-2">
              <Button size="sm" icon={<ListRestart className="w-3.5 h-3.5" />} onClick={planFromOrders} loading={plan.isPending}
                title="Bu öğünün siparişlerindeki menü kaplarını kişi sayısıyla çarpar">Siparişlerden hesapla</Button>
              {rows.length > 0 && (
                <Button size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} loading={refresh.isPending}
                  onClick={() => window.confirm('Bu günün maliyetleri güncel alış fiyatlarıyla yeniden hesaplansın mı?') &&
                    refresh.mutate(date, { onSuccess: () => toast.ok('Maliyetler güncellendi'), onError: toast.error })}>Güncel fiyatla yenile</Button>
              )}
            </div>
          )}>
          {prod.isLoading ? <Loading /> : prod.error ? <div className="p-4"><ErrorNote>Üretim kayıtları yüklenemedi.</ErrorNote></div> : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                    <th className="px-4 py-2.5 font-semibold">Yemek</th>
                    <th className="px-2 py-2.5 font-semibold w-28 text-right">Porsiyon</th>
                    <th className="px-2 py-2.5 font-semibold text-right">Porsiyon maliyeti</th>
                    <th className="px-2 py-2.5 font-semibold text-right">Toplam</th>
                    <th className="px-2 py-2.5 font-semibold text-right w-14">Pay</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => {
                    const r = recipeById.get(l.recipe_id);
                    const line = Number(l.portions) * Number(l.unit_cost);
                    const current = Number(r?.cost_last ?? l.unit_cost);
                    const drift = Math.abs(current - Number(l.unit_cost)) > 0.005;
                    return (
                      <tr key={l.id} className="border-b border-line">
                        <td className="px-4 py-2.5">
                          <Link to={`/receteler/${l.recipe_id}`} className="font-semibold text-ink hover:text-brand">{r?.name ?? 'Reçete'}</Link>
                          <div className="mt-0.5">{l.source === 'siparis' ? <Pill tone="info">siparişten</Pill> : <Pill>elle</Pill>}</div>
                        </td>
                        <td className="px-2 py-2.5"><NumCell label="Porsiyon" value={l.portions} disabled={!canEdit}
                          onCommit={(v) => v && v > 0 && upd.mutate({ id: l.id, portions: v }, { onError: toast.error })} /></td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap">
                          <Money value={l.unit_cost} precise className="text-ink" />
                          {drift && <div className="text-[11px] text-ink-3">bugün <Money value={current} /></div>}
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold"><Money value={line} /></td>
                        <td className="px-2 py-2.5 text-right tc-num text-xs text-ink-3">{total > 0 ? `%${fmtNum((line / total) * 100, 0)}` : ''}</td>
                        <td className="pr-3">
                          {canEdit && (
                            <button type="button" className="p-1.5 rounded-lg text-ink-3 hover:text-stop hover:bg-stop-soft" aria-label="Satırı sil"
                              onClick={() => del.mutate(l.id, { onError: toast.error })}><Trash2 className="w-4 h-4" /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={6}>
                      <EmptyState icon={<ChefHat className="w-5 h-5" />} title="Bu öğün için üretim kaydı yok">
                        {mealOrders.some((o) => o.menu_id) ? '“Siparişlerden hesapla” ile menülerdeki yemekler kişi sayısıyla otomatik gelir.' : 'Siparişlere menü seçerseniz üretim otomatik hesaplanır; ya da aşağıdan elle ekleyin.'}
                      </EmptyState>
                    </td></tr>
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-surface-2/60">
                      <td className="px-4 py-3 font-semibold text-ink">Toplam</td>
                      <td className="px-2 py-3 text-right tc-num text-ink-2">{fmtNum(rows.reduce((s, l) => s + Number(l.portions), 0), 0)}</td>
                      <td />
                      <td className="px-2 py-3 text-right"><Money value={total} className="font-bold text-ink" /></td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-2 p-4 border-t border-line bg-surface-2/60 rounded-b-[18px]">
              <select className="tc-input flex-1" value={nr} onChange={(e) => setNr(e.target.value)} aria-label="Yemek">
                <option value="">Yemek seç…</option>
                {(recipes.data ?? []).filter((r) => r.active).map((r) => <option key={r.recipe_id} value={r.recipe_id!}>{r.name}</option>)}
              </select>
              <input className="tc-input tc-num sm:!w-32" inputMode="decimal" placeholder="Porsiyon" value={np} onChange={(e) => setNp(e.target.value)} aria-label="Porsiyon" />
              <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={addRow} loading={add.isPending}>Ekle</Button>
            </div>
          )}
        </Panel>

        <aside className="space-y-4">
          <Panel title="Kişi başı hammadde" subtitle={`Son ${TREND_DAYS} gün · tüm öğünler`}>
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="tc-num text-2xl font-bold text-ink">{today.pp > 0 ? <Money value={today.pp} /> : '—'}</div>
                <div className="text-[11px] text-ink-3">{shortDay(date)}</div>
              </div>
              {today.pp > 0 && prevDay && <Delta pct={((today.pp - prevDay.pp) / prevDay.pp) * 100} delta={today.pp - prevDay.pp} goodWhen="down" />}
            </div>
            <SparkBars series={series.map((x) => x.pp)} labels={series.map((x) => shortDay(x.d))} className="h-16" />
            <div className="flex justify-between text-[10px] text-ink-3 mt-1"><span>{shortDay(from)}</span><span>{shortDay(date)}</span></div>
          </Panel>

          <Panel title="Menü başına maliyet" subtitle="Bu öğünde servis edilen menüler (güncel fiyatla)">
            {byMenu.length === 0 ? <p className="text-sm text-ink-3">Siparişlerde menü seçilmemiş.</p> : (
              <ul className="space-y-3">
                {byMenu.map(({ menu, ppl }) => (
                  <li key={menu?.menu_id ?? 'x'}>
                    <div className="flex justify-between text-sm"><span className="font-medium text-ink truncate">{menu?.name ?? 'Menü'}</span><Money value={menu?.cost_last} className="font-semibold" /></div>
                    <div className="flex justify-between text-[11px] text-ink-3 mt-0.5">
                      <span>{fmtNum(ppl, 0)} kişi</span>
                      <span>toplam <Money value={Number(menu?.cost_last ?? 0) * ppl} /></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {isFinance && overheadPP !== null && (
            <Panel title="Genel gider payı" subtitle="Son 30 gün: hammadde dışı giderler ÷ kişi">
              <div className="flex justify-between text-sm"><span className="text-ink-3">Giderler</span><Money value={overhead} /></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-ink-3">Kişi</span><span className="tc-num">{fmtNum(ohPeople, 0)}</span></div>
              <div className="flex justify-between text-sm mt-2 pt-2 border-t border-line font-semibold"><span>Kişi başı</span><Money value={overheadPP} /></div>
              <Link to="/finans" className="block text-xs font-semibold text-brand mt-3">Finans özetinde ayrıntı →</Link>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
