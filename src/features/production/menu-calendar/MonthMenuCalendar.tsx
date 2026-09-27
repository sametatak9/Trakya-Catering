import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Redo2, Send, Sparkles, Undo2, Upload } from 'lucide-react';
import { useCan } from '@/app/session';
import { todayISO } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';
import { useLiveTables } from '@/lib/live';
import { askConfirm } from '@/ui/confirm';
import { Button, ErrorNote, Loading, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useRecipeCosts } from '../../kitchen/api';
import { useCustomers } from '../../sales/api';
import {
  fetchPreviousMonth, MENU_KIND_LABELS, MONTHLY_STATUS, useDishRules, useMonthlyDays, useMonthlyMenus, usePublishMonthly,
  useRecipeTags, useSaveMonthlyPlan, useSetMonthlyStatus, type MenuKind, type PublishResult,
} from './api';
import { MealBand, type CellHandlers, type DragState } from './CalendarCell';
import { DishPicker } from './DishPicker';
import {
  addDaysISO, addDish, CAL_MEAL_LABELS, CAL_MEALS, chipFlags, copyDay, copyWeek, courseOfCategory, isoWeekday, monthCells, monthWeeks, moveDish,
  planHints, planViolations, removeDish, rowsToPlan, shiftFromPreviousMonth, slotCost, slotKey, suggestPlan,
  type CalCourse, type CalMeal, type CustomerRule, type Dish, type DishIndex, type Plan,
} from './rules';
import { useCalendarHistory } from './useCalendarHistory';
import './menu-calendar.css';

const DOW = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MEAL_DOT: Record<CalMeal, string> = { kahvalti: '#B97F0A', ogle: '#B4432A', aksam: '#5B4B8A' };
const KIND_COURSES: Record<MenuKind, CalCourse[]> = {
  '3_kap': ['corba', 'ana', 'yardimci'], '4_kap': ['corba', 'ana', 'yardimci', 'tatli'], kahvalti: ['kahvalti', 'kahvalti', 'kahvalti', 'icecek'],
  diyet: ['corba', 'ana', 'salata'], ozel: ['corba', 'ana', 'yardimci', 'salata'],
};
const LEGEND: Array<[CalCourse, string]> = [['corba', 'Çorba'], ['ana', 'Ana yemek'], ['yardimci', 'Yardımcı'], ['salata', 'Salata/meze'], ['tatli', 'Tatlı/meyve'], ['kahvalti', 'Kahvaltılık']];

const monthLabel = (p: string) => new Date(`${p}-15T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
const shiftMonth = (p: string, n: number) => { const [y, m] = p.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const shortRange = (w: string[]) => `${Number(w[0].slice(8))}–${Number(w[w.length - 1].slice(8))} ${new Date(`${w[0]}T12:00:00`).toLocaleDateString('tr-TR', { month: 'short' })}`;

/**
 * Ortak aylık menü takvimi (EK-1 / Not 1, 3, 14). `mode="menu"`: Menüler › Aylık menü. `mode="satinalma"`: Faz 3F'de ihtiyaç paneliyle.
 * Yayınlanan ay `publish_monthly_menu` ile menü planına yazılır; üretim, sipariş ve satınalma aynı planı okur.
 */
export function MonthMenuCalendar({ mode = 'menu', readOnly = false, initialPeriod }: { mode?: 'menu' | 'satinalma'; readOnly?: boolean; initialPeriod?: string }) {
  const toast = useToast();
  const canWrite = useCan(['yonetici', 'asci_basi']) && !readOnly;
  const [period, setPeriod] = useState(initialPeriod ?? todayISO().slice(0, 7));
  const [customerId, setCustomerId] = useState<string>('');
  const [kind, setKind] = useState<MenuKind>('4_kap');
  const [visible, setVisible] = useState<Record<CalMeal, boolean>>({ kahvalti: false, ogle: true, aksam: true });
  const cid = customerId || null;
  const dirtyRef = useRef(false);
  const guard = async (fn: () => void) => { if (dirtyRef.current && !(await askConfirm('Kaydedilmemiş değişiklikler var. Başka aya/müşteriye geçerseniz kaybolur. Devam edilsin mi?'))) return; fn(); };

  const recipes = useRecipeCosts();
  const tags = useRecipeTags();
  const customers = useCustomers();
  const rulesQ = useDishRules(cid);
  const menus = useMonthlyMenus(period, cid, kind);
  const current = menus.data?.[0] ?? null;
  const days = useMonthlyDays(current?.id);
  const save = useSaveMonthlyPlan();
  const publish = usePublishMonthly();
  const setStatus = useSetMonthlyStatus();
  useLiveTables(['monthly_menus', 'monthly_menu_days'], [['monthly'], ['monthly-days']]);

  const index: DishIndex = useMemo(() => {
    const byRecipe = new Map<string, string[]>();
    for (const t of tags.data ?? []) byRecipe.set(t.recipe_id, [...(byRecipe.get(t.recipe_id) ?? []), t.tag]);
    const m: DishIndex = new Map();
    for (const r of recipes.data ?? []) {
      if (!r.recipe_id || r.active === false) continue;
      m.set(r.recipe_id, { name: r.name ?? '—', course: courseOfCategory(r.category_code), tags: byRecipe.get(r.recipe_id) ?? [], cost: r.cost_last == null ? null : Number(r.cost_last) });
    }
    return m;
  }, [recipes.data, tags.data]);
  const rules: CustomerRule[] = useMemo(() => (rulesQ.data ?? []) as CustomerRule[], [rulesQ.data]);

  const hist = useCalendarHistory<Plan>({});
  const plan = hist.value;
  const dirty = hist.steps > 0;
  dirtyRef.current = dirty;
  const [remoteChanged, setRemoteChanged] = useState(false);
  const loadedSig = useRef('');
  // Sunucudan yükle: ay/müşteri/tür ya da sürüm değişince; yerelde kaydedilmemiş değişiklik varsa ezme, uyar
  useEffect(() => {
    if (!recipes.data || menus.isLoading || (current && days.isLoading)) return;
    const sig = `${period}|${cid}|${kind}|${current?.id ?? '-'}|${days.dataUpdatedAt}`;
    if (sig === loadedSig.current) return;
    const sameScope = loadedSig.current.split('|').slice(0, 3).join('|') === `${period}|${cid}|${kind}`;
    if (dirty && sameScope) { setRemoteChanged(true); return; }
    loadedSig.current = sig;
    hist.reset(current ? rowsToPlan(days.data ?? [], index) : {});
    setRemoteChanged(false);
  }, [period, cid, kind, current, days.data, days.dataUpdatedAt, days.isLoading, menus.isLoading, recipes.data, index, dirty, hist]);

  const edit = useCallback((fn: (p: Plan) => Plan, msg?: string) => {
    if (!canWrite) return;
    hist.set(fn);
    if (msg) toast.ok(msg);
  }, [canWrite, hist, toast]);

  const flags = useMemo(() => chipFlags(plan, index, rules), [plan, index, rules]);
  const stats = useMemo(() => {
    let rep = 0, ban = 0, total = 0, n = 0;
    for (const f of flags.values()) { if (f.repeat) rep++; if (f.banned) ban++; }
    for (const k of Object.keys(plan)) { const c = slotCost(plan[k], index); if (plan[k].length) { total += c.cost; n++; } }
    return { rep, ban, avg: n ? total / n : null };
  }, [flags, plan, index]);

  // ── seçici, sürükle-bırak, pano ────────────────────────────────────────────
  const [picker, setPicker] = useState<{ key: string; anchor: DOMRect } | null>(null);
  const drag = useRef<DragState | null>(null);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [targetSlot, setTargetSlot] = useState<string | null>(null);
  const clipboard = useRef<Dish | null>(null);
  const [daySource, setDaySource] = useState<string | null>(null);
  const [dayMenu, setDayMenu] = useState<string | null>(null);

  const handlers: CellHandlers = {
    readOnly: !canWrite,
    onAdd: (key, anchor) => setPicker({ key, anchor }),
    onRemove: (key, i) => edit((p) => removeDish(p, key, i), `“${plan[key]?.[i]?.name}” kaldırıldı`),
    onDragStart: (d) => { drag.current = d; },
    onDrop: (to, copy) => {
      const d = drag.current; drag.current = null;
      if (!d) return;
      const name = plan[d.key]?.[d.index]?.name;
      edit((p) => moveDish(p, d.key, d.index, to, copy), copy ? `“${name}” kopyalandı` : `“${name}” taşındı`);
    },
    onSelectChip: (key, i) => setSelectedChip((s) => (s === `${key}|${i}` ? null : `${key}|${i}`)),
    onSelectSlot: (key) => setTargetSlot((s) => (s === key ? null : key)),
    selectedChip, targetSlot,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); hist.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); hist.redo(); }
      else if (k === 'c' && selectedChip) {
        const [d, m, i] = selectedChip.split('|');
        clipboard.current = plan[`${d}|${m}`]?.[Number(i)] ?? null;
        if (clipboard.current) toast.ok(`“${clipboard.current.name}” kopyalandı — hedef öğünü seçip Ctrl+V`);
      } else if (k === 'v' && targetSlot && clipboard.current && canWrite) {
        e.preventDefault();
        const dish = clipboard.current;
        edit((p) => addDish(p, targetSlot, { ...dish }), `“${dish.name}” yapıştırıldı`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hist, selectedChip, targetSlot, plan, canWrite, edit, toast]);

  // ── ay işlemleri ───────────────────────────────────────────────────────────
  const weeks = monthWeeks(period);
  const mondays = weeks.map((w) => addDaysISO(w[0], 1 - isoWeekday(w[0])));
  const [wkFrom, setWkFrom] = useState(0);
  const [wkTo, setWkTo] = useState(1);
  const [agendaWeek, setAgendaWeek] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const shownMeals = CAL_MEALS.filter((m) => visible[m]);

  const doCopyWeek = () => {
    if (wkFrom === wkTo) return toast.error('Kaynak ve hedef hafta aynı');
    edit((p) => copyWeek(p, mondays[wkFrom], mondays[wkTo], period, shownMeals), `${shortRange(weeks[wkFrom])} → ${shortRange(weeks[wkTo])} kopyalandı`);
  };
  const startFromPrevious = async () => {
    try {
      const prevPeriod = shiftMonth(period, -1);
      const rows = await fetchPreviousMonth(prevPeriod, cid, kind);
      if (!rows.length) return toast.error(`${monthLabel(prevPeriod)} için kayıtlı menü yok`);
      const prev = rowsToPlan(rows, index);
      edit((p) => ({ ...shiftFromPreviousMonth(prev, prevPeriod, period), ...p }), `${monthLabel(prevPeriod)} menüsü boş günlere taşındı (dolu günler korundu)`);
    } catch (e) { toast.error(e); }
  };

  const [suggestion, setSuggestion] = useState<Plan | null>(null);
  const makeSuggestion = () => {
    const avgCost = stats.avg;
    setSuggestion(suggestPlan({ period, meals: shownMeals.length ? shownMeals : ['ogle'], courses: KIND_COURSES[kind], index, rules, existing: plan, maxCostPerMeal: avgCost ? avgCost * 1.1 : null }));
  };
  const suggestionAdded = suggestion ? Object.keys(suggestion).filter((k) => !plan[k]?.length).length : 0;

  const [serverViolations, setServerViolations] = useState<PublishResult['violations'] | null>(null);
  const clientViolations = useMemo(() => planViolations(plan, index, rules), [plan, index, rules]);

  const doSave = async (): Promise<string | null> => {
    if (current && (current.status === 'yayinda' || current.status === 'arsiv')) {
      if (!(await askConfirm(`Sürüm ${current.version} yayında ve kilitli. Değişiklikler yeni sürüm (${current.version + 1}) olarak taslağa kaydedilecek. Devam edilsin mi?`))) return null;
    }
    try {
      const id = await save.mutateAsync({ period, customerId: cid, kind, current, plan });
      loadedSig.current = ''; setRemoteChanged(false);
      toast.ok('Taslak kaydedildi');
      return id;
    } catch (e) { toast.error(e); return null; }
  };
  const doPublish = async () => {
    setServerViolations(null);
    if (clientViolations.length) { toast.error(`${clientViolations.length} kural ihlali var: gerekçe yazın ya da yemeği değiştirin`); return; }
    if (!Object.keys(plan).length) return toast.error('Boş ay yayınlanamaz');
    let id = current?.id ?? null;
    if (dirty || !current || current.status === 'yayinda' || current.status === 'arsiv') id = await doSave();
    if (!id) return;
    if (!(await askConfirm(`${monthLabel(period)} · ${custName} · ${MENU_KIND_LABELS[kind]} yayınlanacak. Günlük menü planı, üretim ve sipariş ekranları bu menüyü kullanacak. Devam edilsin mi?`))) return;
    try {
      const r = await publish.mutateAsync(id);
      if (!r.ok) { setServerViolations(r.violations ?? []); toast.error('Yayınlanamadı: kural ihlali'); return; }
      loadedSig.current = '';
      toast.ok(`Yayınlandı: ${r.slots} gün × öğün menü planına yazıldı`);
    } catch (e) { toast.error(e); }
  };
  const sendForApproval = async () => {
    const id = dirty || !current ? await doSave() : current.id;
    if (!id) return;
    try { await setStatus.mutateAsync({ id, status: 'onay' }); toast.ok('Onaya gönderildi'); } catch (e) { toast.error(e); }
  };

  const custName = customerId ? (customers.data ?? []).find((c) => c.id === customerId)?.name ?? 'Müşteri' : 'Genel';
  const ruleText = rules.map((r) => r.note || (r.rule === 'yasak_etiket' ? `${r.tag} yok` : r.rule === 'gun_yasak' ? `${DOW[(r.weekday ?? 1) - 1]} ${r.tag ?? ''} yok` : r.rule === 'haftalik_en_fazla' ? `haftada en fazla ${r.qty} ${r.tag}` : r.rule === 'haftalik_en_az' ? `haftada en az ${r.qty} ${r.tag}` : r.rule === 'tercih_etiket' ? `tercih: ${r.tag}` : 'belirli yemek yok'));
  const today = todayISO();

  const dayCost = (day: string) => shownMeals.reduce((s, m) => s + slotCost(plan[slotKey(day, m)] ?? [], index).cost, 0);
  const dayHead = (day: string, inMonth: boolean, agenda = false) => (
    <div className="mc-dhead">
      <span className="mc-dnum">{agenda ? new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }) : Number(day.slice(8))}</span>
      {inMonth && dayCost(day) > 0 && <span className="mc-dcost tc-num">{dayCost(day).toFixed(0)} ₺</span>}
      {inMonth && canWrite && (
        <span className="relative">
          <button type="button" className="mc-dmenu" aria-label={`${day} gün işlemleri`} onClick={() => setDayMenu((d) => (d === day ? null : day))}>⋯</button>
          {dayMenu === day && (
            <span className="absolute right-0 top-6 z-20 w-44 rounded-xl border border-line bg-card p-1 shadow-lg text-left">
              <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2 text-left" onClick={() => { setDaySource(day); setDayMenu(null); toast.ok('Gün kopyalandı — hedef günün ⋯ menüsünden yapıştırın'); }}>Günü kopyala</button>
              {daySource && daySource !== day && <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2 text-left" onClick={() => { edit((p) => copyDay(p, daySource, day, shownMeals), `${Number(daySource.slice(8))}. gün buraya yapıştırıldı`); setDayMenu(null); }}>Buraya yapıştır ({Number(daySource.slice(8))}. gün)</button>}
              <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2 text-left text-[var(--tc-stop)]" onClick={() => { edit((p) => { const n = { ...p }; for (const m of shownMeals) delete n[slotKey(day, m)]; return n; }, 'Gün temizlendi'); setDayMenu(null); }}>Günü temizle</button>
            </span>
          )}
        </span>
      )}
    </div>
  );
  const meals = (day: string) => shownMeals.map((m) => {
    if (isoWeekday(day) === 7 && !(plan[slotKey(day, m)]?.length) && !canWrite) return null;
    return <MealBand key={m} day={day} meal={m} plan={plan} flags={flags} index={index} h={handlers} />;
  });

  if (recipes.isLoading || menus.isLoading) return <Loading label="Aylık menü yükleniyor…" />;
  if (recipes.error || menus.error) return <ErrorNote>Aylık menü yüklenemedi.</ErrorNote>;

  const status = current ? MONTHLY_STATUS[current.status] : null;
  const week = weeks[Math.min(agendaWeek, weeks.length - 1)] ?? [];

  return (
    <div className="mc">
      {/* başlık satırı: ay, sürüm, işlemler */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-card p-[3px]">
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-surface-2" aria-label="Önceki ay" onClick={() => guard(() => setPeriod((p) => shiftMonth(p, -1)))}><ChevronLeft className="mx-auto h-4 w-4" /></button>
          <span className="min-w-[128px] px-2 text-center font-display text-[15px] font-bold capitalize">{monthLabel(period)}</span>
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-surface-2" aria-label="Sonraki ay" onClick={() => guard(() => setPeriod((p) => shiftMonth(p, 1)))}><ChevronRight className="mx-auto h-4 w-4" /></button>
        </div>
        {status ? <Pill tone={status.tone}>Sürüm {current!.version} · {status.label}</Pill> : <Pill>Henüz kayıt yok</Pill>}
        {dirty && <Pill tone="wait">Kaydedilmemiş değişiklik</Pill>}
        <span className="flex-1" />
        {canWrite && <>
          <Button size="sm" icon={<Undo2 className="h-4 w-4" />} onClick={() => { hist.undo(); }} disabled={!hist.canUndo} title="Geri al (Ctrl+Z)" aria-label="Geri al"><span className="hidden sm:inline">Geri al</span></Button>
          <Button size="sm" icon={<Redo2 className="h-4 w-4" />} onClick={() => { hist.redo(); }} disabled={!hist.canRedo} title="Yinele (Ctrl+Shift+Z)" aria-label="Yinele"><span className="hidden sm:inline">Yinele</span></Button>
          <Button size="sm" className="mc-btn-ai" icon={<Sparkles className="h-4 w-4" />} onClick={makeSuggestion} aria-label="Öneri ile doldur" title="Kural motoruyla boş günleri doldur"><span className="hidden sm:inline">Öneri ile doldur</span></Button>
          <Button size="sm" onClick={doSave} loading={save.isPending} disabled={!dirty}>Taslağı kaydet</Button>
          {current?.status === 'taslak' && !dirty && <Button size="sm" icon={<Send className="h-4 w-4" />} onClick={sendForApproval} loading={setStatus.isPending}>Onaya gönder</Button>}
          <Button size="sm" variant="primary" icon={<Upload className="h-4 w-4" />} onClick={doPublish} loading={publish.isPending}>Yayınla</Button>
        </>}
      </div>

      {remoteChanged && <div className="mc-note" style={{ background: 'var(--tc-info-soft)', color: 'var(--tc-info)' }}>Bu ay başka bir kullanıcı tarafından güncellendi. Kaydederseniz sizin sürümünüz yeni taslak olur; önce sayfayı yenileyip değişiklikleri görmeniz önerilir.</div>}

      <div className={cx('mc-bar', filtersOpen && 'open')}>
        <div className="mc-field">
          <label htmlFor="mc-cust">Müşteri</label>
          <select id="mc-cust" className="tc-input !h-9 !py-0" value={customerId} onChange={(e) => { const v = e.target.value; void guard(() => setCustomerId(v)); }}>
            <option value="">Genel (tüm müşteriler)</option>
            {(customers.data ?? []).filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="mc-field opt"><label>Kap türü</label>
          <div className="mc-seg">{(Object.keys(MENU_KIND_LABELS) as MenuKind[]).map((k) => <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => guard(() => setKind(k))}>{MENU_KIND_LABELS[k]}</button>)}</div>
        </div>
        <div className="mc-field opt"><label>Öğünler</label>
          <div className="mc-seg">{CAL_MEALS.map((m) => (
            <button type="button" key={m} className={visible[m] ? 'on' : ''} onClick={() => setVisible((v) => ({ ...v, [m]: !v[m] }))}><i className="mc-dot" style={{ background: MEAL_DOT[m] }} />{CAL_MEAL_LABELS[m]}</button>
          ))}</div>
        </div>
        {canWrite && weeks.length > 1 && (
          <div className="mc-field opt"><label>Haftayı kopyala</label>
            <div className="flex items-center gap-1.5">
              <select className="tc-input !h-9 !w-auto !py-0" value={wkFrom} onChange={(e) => setWkFrom(Number(e.target.value))} aria-label="Kaynak hafta">{weeks.map((w, i) => <option key={i} value={i}>{shortRange(w)}</option>)}</select>
              <span className="text-ink-3">→</span>
              <select className="tc-input !h-9 !w-auto !py-0" value={wkTo} onChange={(e) => setWkTo(Number(e.target.value))} aria-label="Hedef hafta">{weeks.map((w, i) => <option key={i} value={i}>{shortRange(w)}</option>)}</select>
              <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={doCopyWeek}>Kopyala</Button>
            </div>
          </div>
        )}
        {canWrite && <div className="mc-field opt"><label>&nbsp;</label><Button size="sm" onClick={startFromPrevious}>Geçen aydan başlat</Button></div>}
        <span className="flex-1" />
        <button type="button" className="mc-fbtn tc-input !h-9 !w-auto !py-0 font-semibold" onClick={() => setFiltersOpen((o) => !o)}>Filtreler ▾</button>
        <div className="mc-field opt"><label>Ay özeti</label>
          <div className="flex h-9 items-center gap-3.5 text-[13px]">
            <span>Öğün başı gıda ort. <b className="tc-num">{stats.avg == null ? '—' : fmtMoney(stats.avg)}</b></span>
            <span style={{ color: 'var(--tc-wait)' }}>↻ <b>{stats.rep}</b> tekrar</span>
            <span style={{ color: 'var(--tc-stop)' }}>⛔ <b>{stats.ban}</b> istenmeyen</span>
          </div>
        </div>
      </div>

      {customerId && rules.length > 0 && <div className="mc-note">⛔ <span><b>{custName}</b> istemiyor: {ruleText.join(' · ')} — takvimde kırmızı işaretlenir, eklerken uyarı çıkar.</span></div>}
      {customerId && rules.length === 0 && <div className="mb-3 text-xs text-ink-3">Bu müşteri için yemek kuralı yok. Cari › müşteri › Hassasiyet sekmesinden “patlıcan yok”, “cuma balık yok” gibi kurallar eklenebilir.</div>}

      {suggestion && (
        <div className="mc-ai">
          <h3><Sparkles className="h-4 w-4" /> Menü önerisi — {monthLabel(period)} ({shownMeals.map((m) => CAL_MEAL_LABELS[m].toLocaleLowerCase('tr')).join(' + ')})</h3>
          <ul>
            <li>Boş {suggestionAdded} gün × öğün dolduruldu; dolu hücreler korunur. Pazar boş bırakıldı.</li>
            <li>Aynı çorba/ana yemek 7 gün içinde tekrarlanmıyor; etiketler (tavuk, kırmızı et, bakliyat…) dengeli dağıtıldı.</li>
            {customerId && rules.length > 0 && <li>Müşteri kuralları uygulandı: {ruleText.join(', ')}.</li>}
            {stats.avg != null && <li>Öğün başı hedef gıda maliyeti ≤ {fmtMoney(stats.avg * 1.1)} (mevcut ortalama + %10).</li>}
            {planHints(suggestion, index).map((h, i) => <li key={i}>{h}</li>)}
            <li className="text-ink-3">AI anahtarı tanımlı olmadığı için öneriyi kural motoru üretti (🔌 AI önerisi Edge Function ile açılır).</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => { const s = suggestion; edit(() => s, 'Öneri taslağa uygulandı — Ctrl+Z ile geri alabilirsiniz'); setSuggestion(null); }}>Öneriyi taslağa uygula</Button>
            <Button size="sm" onClick={() => setSuggestion(null)}>Kapat</Button>
          </div>
        </div>
      )}

      {(clientViolations.length > 0 || (serverViolations?.length ?? 0) > 0) && (
        <div className="mb-3 rounded-2xl border border-[#F2A9A2] bg-[var(--tc-stop-soft)] p-3 text-sm">
          <b className="text-[var(--tc-stop)]">Yayından önce düzeltilmesi gerekenler</b>
          <ul className="mt-1 list-disc pl-5 text-ink-2">
            {clientViolations.slice(0, 12).map((v, i) => <li key={`c${i}`}>{v.message}</li>)}
            {(serverViolations ?? []).slice(0, 12).map((v, i) => <li key={`s${i}`}>{v.day ?? ''} {v.detail}</li>)}
          </ul>
          <div className="mt-1 text-xs text-ink-3">Kırmızı yemeği değiştirin veya çipi kaldırıp “+” ile gerekçe yazarak yeniden ekleyin.</div>
        </div>
      )}

      <div className={cx('mc-grid-wrap', mode === 'satinalma' && 'buy')}>
        <div className="mc-cal">
          <div className="mc-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mc-weeks">
            {monthCells(period).map(({ day, inMonth }) => (
              <div key={day} className={cx('mc-day', !inMonth && 'out', isoWeekday(day) >= 6 && 'we', day === today && 'today', daySource === day && 'src')}>
                {dayHead(day, inMonth)}
                {inMonth && meals(day)}
              </div>
            ))}
          </div>
          <div className="mc-agenda">
            <div className="mc-wkstrip">{weeks.map((w, i) => <button type="button" key={i} className={i === agendaWeek ? 'on' : ''} onClick={() => setAgendaWeek(i)}>{shortRange(w)}</button>)}</div>
            {week.filter((d) => isoWeekday(d) !== 7 || shownMeals.some((m) => plan[slotKey(d, m)]?.length)).map((day) => (
              <div key={day} className="mc-aday">{dayHead(day, true, true)}{meals(day)}</div>
            ))}
          </div>
          <div className="mc-legend">
            {LEGEND.map(([c, l]) => <span key={c}><i className={`sw k-${c}`} />{l}</span>)}
            <span><i className="lg-rep" />7 gün içinde tekrar</span><span><i className="lg-ban" />Müşteri istemiyor</span>
            {canWrite && <span style={{ marginLeft: 'auto' }}>Sürükle = taşı · <b>Alt/Ctrl + sürükle</b> = kopyala · <b>+</b> = hızlı ekle · Ctrl+C / Ctrl+V · Ctrl+Z = geri al</span>}
          </div>
        </div>
        {mode === 'satinalma' && (
          <aside className="mc-buyp" aria-label="Satınalma ihtiyacı">
            <h2 className="font-display text-[17px] font-bold">İhtiyaç (menüden)</h2>
            <p className="mt-1 text-xs text-ink-3">Takvimdeki yemekler × kişi sayısı × 1 kişilik reçete − depo stoku. Sürümlü satınalma planı Faz 3F'de bu panele bağlanır.</p>
          </aside>
        )}
      </div>

      {picker && (
        <DishPicker anchor={picker.anchor} slot={picker.key} index={index} rules={rules} onClose={() => setPicker(null)}
          onPick={(id, override) => {
            const info = index.get(id)!;
            edit((p) => addDish(p, picker.key, { recipeId: id, name: info.name, course: info.course, override }), `“${info.name}” eklendi`);
            setPicker(null);
          }} />
      )}
    </div>
  );
}
