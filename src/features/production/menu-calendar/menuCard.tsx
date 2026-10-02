import type { ReportSpec } from '@/reports/ReportButton';
import { CAL_MEAL_LABELS, CAL_MEALS, isoWeekday, monthWeeks, slotKey, type CalMeal, type Plan } from './rules';

export type MenuCardVariant = 'standart' | 'kalorili' | 'kahvalti';
export const MENU_CARD_LABELS: Record<MenuCardVariant, string> = { standart: 'Menü kartı (standart)', kalorili: 'Menü kartı (kalori hesaplı)', kahvalti: 'Kahvaltı menüsü' };

const DOW = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const dayTitle = (d: string) => `${Number(d.slice(8))} ${DOW[isoWeekday(d) - 1]}`;

/**
 * Firmalara gönderilen aylık menü kartı (ANA-PROMPT: HTML + PDF; standart, kalori hesaplı, kahvaltı).
 * Rapor çerçevesi logo/antet, yazdır/PDF, Excel ve WhatsApp paylaşımını hazır verir.
 * Kalori: v_recipe_kcal (stok kartındaki kcal/100 g); eksik veri "—" ile ve dipnotta gösterilir.
 */
export function menuCardSpec(o: {
  variant: MenuCardVariant; plan: Plan; period: string; periodLabel: string; customerName: string; kindLabel: string;
  kcal: Map<string, { kcal: number | null; missing: number }>;
}): ReportSpec {
  const meals: CalMeal[] = o.variant === 'kahvalti' ? ['kahvalti'] : CAL_MEALS.filter((m) => m !== 'kahvalti' && Object.keys(o.plan).some((k) => k.endsWith(`|${m}`)));
  const showK = o.variant === 'kalorili';
  const weeks = monthWeeks(o.period).map((w) => w.filter((d) => meals.some((m) => o.plan[slotKey(d, m)]?.length)));
  const kc = (id: string) => o.kcal.get(id);
  const slotKcal = (d: string, m: CalMeal) => {
    const arr = o.plan[slotKey(d, m)] ?? [];
    let sum = 0, missing = 0;
    for (const x of arr) { const k = kc(x.recipeId); if (k?.kcal == null || k.missing > 0) missing++; if (k?.kcal != null) sum += k.kcal; }
    return { sum, missing, count: arr.length };
  };
  let anyMissing = false;
  const rows: Array<Array<string | number | null>> = [];
  for (const w of weeks) for (const d of w) for (const m of meals) {
    for (const x of o.plan[slotKey(d, m)] ?? []) {
      const k = kc(x.recipeId);
      if (showK && (k?.kcal == null || (k?.missing ?? 0) > 0)) anyMissing = true;
      rows.push([d, CAL_MEAL_LABELS[m], x.name, ...(showK ? [k?.kcal ?? null] : [])]);
    }
  }
  const title = o.variant === 'kahvalti' ? 'Kahvaltı Menüsü' : o.variant === 'kalorili' ? 'Aylık Menü · Kalori Hesaplı' : 'Aylık Menü';
  return {
    title,
    subtitle: `${o.periodLabel} · ${o.customerName} · ${o.kindLabel}`,
    summary: weeks.flat().slice(0, 12).map((d) => ({ label: dayTitle(d), value: meals.map((m) => (o.plan[slotKey(d, m)] ?? []).map((x) => x.name).join(', ')).filter(Boolean).join(' / ') })),
    table: { filename: `menu-${o.variant}-${o.period}`, header: ['Tarih', 'Öğün', 'Yemek', ...(showK ? ['kcal (1 kişi)'] : [])], rows },
    body: () => (
      <>
        {weeks.filter((w) => w.length).map((w, wi) => (
          <table key={wi} style={{ marginBottom: 14 }}>
            <thead><tr><th style={{ width: '18%' }}>Gün</th>{meals.map((m) => <th key={m}>{CAL_MEAL_LABELS[m]}</th>)}</tr></thead>
            <tbody>
              {w.map((d) => (
                <tr key={d}>
                  <td><b>{dayTitle(d)}</b></td>
                  {meals.map((m) => {
                    const arr = o.plan[slotKey(d, m)] ?? [];
                    const s = slotKcal(d, m);
                    return (
                      <td key={m}>
                        {arr.map((x, i) => (
                          <div key={i}>{x.name}{showK && <span style={{ color: '#857B6D' }}> · {kc(x.recipeId)?.kcal != null ? `${kc(x.recipeId)!.kcal} kcal` : '—'}</span>}</div>
                        ))}
                        {showK && arr.length > 0 && <div style={{ marginTop: 3, fontWeight: 700 }}>Toplam {s.sum} kcal{s.missing ? '*' : ''}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        {showK && <p style={{ fontSize: 11, color: '#857B6D' }}>Kalori 1 kişilik porsiyon içindir; reçetedeki net gramaj × stok kartındaki enerji değeri (kcal/100 g) ile hesaplanır.{anyMissing ? ' * Bazı malzemelerin kalori değeri girilmediği için toplam eksik olabilir.' : ''}</p>}
        <p style={{ fontSize: 11, color: '#857B6D' }}>Menüde mevsime ve tedarike göre değişiklik olabilir. Alerjen bilgisi için bize ulaşın.</p>
      </>
    ),
  };
}
