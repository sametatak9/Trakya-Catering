import { useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { Link } from '@/app/router';
import { useCan } from '@/app/session';
import { addDays, shortDay, todayISO } from '@/lib/dates';
import { MEALS, ROLES } from '@/lib/domain';
import { fmtMoney } from '@/lib/format';
import { COURSE_LABELS, COURSE_ORDER, type Course } from '@/lib/prep';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection } from '@/reports/ReportFrame';
import { presetRange } from '@/ui/DateRange';
import { Hint } from '@/ui/bits';
import { Button, EmptyState, ModuleHero, Money, Panel, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useMenuCosts, useRecipeCosts } from '../kitchen/api';
import { useCustomers } from '../sales/api';
import { useCopyMenuWeek, useMenuItemsIndex, useMenuPlans, useSetMenuPlan } from './api';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function MenuPlanPage() {
  const toast = useToast();
  const canEdit = useCan(ROLES.kitchenWrite);
  const [weekStart, setWeekStart] = useState(() => presetRange('bu_hafta').from);
  const [customer, setCustomer] = useState<string>('');   // '' = genel
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const plans = useMenuPlans(days[0], days[6]);
  const prevPlans = useMenuPlans(addDays(weekStart, -7), addDays(weekStart, -1));
  const menus = useMenuCosts();
  const customers = useCustomers();
  const recipes = useRecipeCosts();
  const index = useMenuItemsIndex().data;
  const setPlan = useSetMenuPlan();
  const copy = useCopyMenuWeek();
  const today = todayISO();

  const cid = customer || null;
  const menuList = (menus.data ?? []).filter((m) => m.active && (!m.customer_id || m.customer_id === cid));
  const menuName = (id: string | null | undefined) => (menus.data ?? []).find((m) => m.menu_id === id)?.name ?? '';
  const recipeName = (id: string) => (recipes.data ?? []).find((r) => r.recipe_id === id)?.name ?? '';
  const planOf = (d: string, meal: string, c: string | null) =>
    (plans.data ?? []).find((p) => p.plan_date === d && p.meal === meal && (p.customer_id ?? null) === c);
  const meals = Object.keys(MEALS);
  const custName = (id: string | null) => (customers.data ?? []).find((c) => c.id === id)?.name ?? 'Genel';

  const copyPrevWeek = async () => {
    const existing = new Set((plans.data ?? []).map((p) => `${p.plan_date}|${p.meal}|${p.customer_id ?? ''}`));
    const rows = (prevPlans.data ?? [])
      .map((p) => ({ plan_date: addDays(p.plan_date, 7), meal: p.meal, customer_id: p.customer_id, menu_id: p.menu_id }))
      .filter((p) => !existing.has(`${p.plan_date}|${p.meal}|${p.customer_id ?? ''}`));
    if (rows.length === 0) return toast.error('Kopyalanacak yeni plan yok');
    try { const n = await copy.mutateAsync(rows); toast.ok(`${n} plan geçen haftadan kopyalandı`); } catch (e) { toast.error(e); }
  };

  const dishesOf = (menuId: string) =>
    [...(index?.get(menuId) ?? [])].sort((a, b) => COURSE_ORDER.indexOf(a.course as Course) - COURSE_ORDER.indexOf(b.course as Course));

  const weekReport = (): ReportSpec => ({
    title: 'Haftalık Menü',
    subtitle: `${shortDay(days[0])} – ${shortDay(days[6])} · ${custName(cid)}`,
    phone: cid ? (customers.data ?? []).find((c) => c.id === cid)?.phone : null,
    summary: days.flatMap((d, i) => meals.map((m) => {
      const p = planOf(d, m, cid) ?? (cid ? planOf(d, m, null) : undefined);
      return p ? { label: `${WEEKDAYS[i]} ${shortDay(d)} ${MEALS[m]}`, value: dishesOf(p.menu_id).map((x) => recipeName(x.recipe)).join(', ') || menuName(p.menu_id) } : null;
    })).filter(Boolean) as Array<{ label: string; value: string }>,
    body: () => (
      <>
        {meals.map((m) => {
          const any = days.some((d) => planOf(d, m, cid) ?? (cid ? planOf(d, m, null) : undefined));
          if (!any) return null;
          return (
            <ReportSection key={m} title={MEALS[m]}>
              <table>
                <thead><tr><th style={{ width: '18%' }}>Gün</th><th>Menü</th><th className="num">Kişi başı maliyet</th></tr></thead>
                <tbody>
                  {days.map((d, i) => {
                    const p = planOf(d, m, cid) ?? (cid ? planOf(d, m, null) : undefined);
                    if (!p) return null;
                    const mc = (menus.data ?? []).find((x) => x.menu_id === p.menu_id);
                    return (
                      <tr key={d}>
                        <td><b>{WEEKDAYS[i]}</b> {shortDay(d)}</td>
                        <td>
                          <div className="font-semibold">{mc?.name}</div>
                          <div style={{ color: '#4A443C' }}>{dishesOf(p.menu_id).map((x) => `${recipeName(x.recipe)}`).join(' · ')}</div>
                        </td>
                        <td className="num">{fmtMoney(mc?.cost_last)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ReportSection>
          );
        })}
      </>
    ),
  });

  return (
    <>
      <ModuleHero
        kicker="Mutfak · Diyetisyen"
        title="Menü Planı"
        description="Haftanın her günü ve öğünü için menü seçin. Firmaya özel plan genel planı geçersiz kılar. Siparişlerde menü seçilmemişse buradan gelir; Günlük Hazırlık yemek başlıklarını bu plandan kurar."
        actions={<>
          <ReportButton spec={weekReport} label="Haftalık menü" />
          {canEdit && <Button icon={<Copy className="w-4 h-4" />} onClick={copyPrevWeek} loading={copy.isPending}>Geçen haftayı kopyala</Button>}
        </>}
      />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-xl ring-1 ring-line bg-card text-ink-2" aria-label="Önceki hafta"><ChevronLeft className="w-4 h-4" /></button>
          <div className="min-w-[180px] text-center text-sm font-semibold text-ink">{shortDay(days[0])} – {shortDay(days[6])}</div>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-xl ring-1 ring-line bg-card text-ink-2" aria-label="Sonraki hafta"><ChevronRight className="w-4 h-4" /></button>
          {days[0] !== presetRange('bu_hafta').from && <button type="button" onClick={() => setWeekStart(presetRange('bu_hafta').from)} className="px-3 py-2 text-xs font-semibold text-brand">Bu hafta</button>}
        </div>
        <select className="tc-input lg:!w-72" value={customer} onChange={(e) => setCustomer(e.target.value)} aria-label="Plan kapsamı">
          <option value="">Genel plan (tüm firmalar)</option>
          {(customers.data ?? []).filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name} — firmaya özel</option>)}
        </select>
      </div>

      {(menus.data ?? []).length === 0 && !menus.isLoading ? (
        <div className="tc-card">
          <EmptyState icon={<CalendarRange className="w-5 h-5" />} title="Önce menü oluşturun"
            action={<Link to="/menuler" className="text-sm font-semibold text-brand">Menüler →</Link>}>
            Plan, kayıtlı menülerden seçilerek yapılır (kahvaltı, standart, soğuk mezeli…).
          </EmptyState>
        </div>
      ) : (
        <Panel pad={false}>
          {cid && <div className="p-4 border-b border-line"><Hint>Boş bırakılan hücrelerde genel plan geçerli olur (gri yazıyla gösterilir).</Hint></div>}
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full text-sm min-w-[980px] table-fixed">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-28 px-3 py-2.5 text-left text-[11px] uppercase tracking-wider text-ink-3">Öğün</th>
                  {days.map((d, i) => (
                    <th key={d} className={cx('px-2 py-2.5 text-left', d === today && 'bg-brand-soft/50')}>
                      <div className="text-xs font-bold text-ink">{WEEKDAYS[i]}</div>
                      <div className="text-[11px] text-ink-3 font-normal">{shortDay(d)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meals.map((m) => (
                  <tr key={m} className="border-b border-line last:border-0 align-top">
                    <td className="px-3 py-3 text-sm font-semibold text-ink">{MEALS[m]}</td>
                    {days.map((d) => {
                      const own = planOf(d, m, cid);
                      const inherited = cid ? planOf(d, m, null) : undefined;
                      const mc = (menus.data ?? []).find((x) => x.menu_id === (own ?? inherited)?.menu_id);
                      return (
                        <td key={d} className={cx('px-2 py-2', d === today && 'bg-brand-soft/30')}>
                          <select className={cx('tc-input !py-1.5 !px-2 text-xs', !own && inherited && 'text-ink-3')} disabled={!canEdit}
                            value={own?.menu_id ?? ''} aria-label={`${d} ${MEALS[m]} menüsü`}
                            onChange={(e) => setPlan.mutate({ date: d, meal: m, customerId: cid, menuId: e.target.value || null }, { onError: toast.error })}>
                            <option value="">{inherited ? `↳ ${menuName(inherited.menu_id)}` : '—'}</option>
                            {menuList.filter((x) => m === 'kahvalti' ? x.meal === 'kahvalti' || x.kind === 'kahvalti' : x.kind !== 'kahvalti').map((x) => (
                              <option key={x.menu_id} value={x.menu_id!}>{x.name}</option>
                            ))}
                          </select>
                          {mc && (
                            <div className="mt-1.5 space-y-0.5">
                              {dishesOf(mc.menu_id!).slice(0, 6).map((x) => (
                                <div key={x.recipe} className="text-[10.5px] text-ink-2 truncate" title={`${COURSE_LABELS[x.course as Course]}: ${recipeName(x.recipe)}`}>{recipeName(x.recipe)}</div>
                              ))}
                              <div className="text-[10.5px] font-semibold text-ink tc-num"><Money value={mc.cost_last} /></div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
