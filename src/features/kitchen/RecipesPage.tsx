import { useMemo, useState } from 'react';
import { BookOpenText, Plus, Search } from 'lucide-react';
import { Link, useRouter } from '@/app/router';
import { useCan } from '@/app/session';
import { ALLERGENS, ROLES } from '@/lib/domain';
import { fmtNum } from '@/lib/format';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Money, Pill, Tabs, cx } from '@/ui/primitives';
import { useCategories, useRecipeCosts } from './api';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { fmtMoney } from '@/lib/format';

export function RecipesPage() {
  const { go } = useRouter();
  const canEdit = useCan(ROLES.kitchenWrite);
  const costs = useRecipeCosts();
  const cats = useCategories();
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');

  const list = costs.data ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return list.filter((r) => (cat === 'all' || r.category_code === cat)
      && (!needle || (r.name ?? '').toLocaleLowerCase('tr').includes(needle)));
  }, [list, cat, q]);

  const priced = list.filter((r) => (r.line_count ?? 0) > 0);
  const avg = priced.length ? priced.reduce((s, r) => s + Number(r.cost_last ?? 0), 0) / priced.length : null;
  const missing = list.filter((r) => (r.missing_price_count ?? 0) > 0).length;
  const empty = list.filter((r) => (r.line_count ?? 0) === 0).length;
  const catName = (code: string | null) => cats.data?.find((c) => c.code === code)?.name ?? code ?? '';

  const tabs = [{ id: 'all', label: 'Tümü', count: list.length },
    ...(cats.data ?? []).filter((c) => list.some((r) => r.category_code === c.code))
      .map((c) => ({ id: c.code, label: c.name, count: list.filter((r) => r.category_code === c.code).length }))];

  const report = (): ReportSpec => ({
    title: 'Reçete Maliyet Listesi',
    subtitle: `${filtered.length} reçete · 1 porsiyon, son alış fiyatlarıyla`,
    summary: filtered.map((r) => ({ label: r.name ?? '', value: `${fmtMoney(r.cost_last)} / porsiyon` })),
    table: {
      filename: 'recete-maliyetleri',
      header: ['Reçete', 'Kategori', 'Kalem', 'Net gram', 'Porsiyon maliyeti ₺', 'Eksik fiyat', 'Alerjenler'],
      rows: filtered.map((r) => [r.name, catName(r.category_code), r.line_count, r.total_net_g, r.cost_last, r.missing_price_count, (r.allergens ?? []).map((a) => ALLERGENS[a]).join(', ')]),
    },
    body: () => (
      <table>
        <thead><tr><th>Reçete</th><th>Kategori</th><th className="num">Kalem</th><th className="num">Net gram</th><th className="num">1 porsiyon</th><th>Alerjen</th></tr></thead>
        <tbody>{filtered.map((r) => <tr key={r.recipe_id}><td>{r.name}</td><td>{catName(r.category_code)}</td><td className="num">{r.line_count}</td>
          <td className="num">{fmtNum(r.total_net_g, 0)}</td><td className="num"><b>{fmtMoney(r.cost_last)}</b></td><td>{(r.allergens ?? []).map((a) => ALLERGENS[a]).join(', ')}</td></tr>)}</tbody>
      </table>
    ),
  });

  return (
    <>
      <ModuleHero
        kicker="Mutfak · Ürün ağacı (BOM)"
        title="Reçeteler & Gramaj"
        description="1 porsiyonun net gramajı, fire ile brüt ihtiyaç ve güncel alış fiyatlarından anlık porsiyon maliyeti."
        actions={<>
          <ReportButton spec={report} disabled={list.length === 0} />
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => go('/receteler/yeni')}>Yeni reçete</Button>}
        </>}
        stats={[
          { label: 'Reçete', value: list.length },
          { label: 'Ort. porsiyon maliyeti', value: avg === null ? '—' : <Money value={avg} /> },
          { label: 'Fiyatı eksik reçete', value: missing, tone: missing ? 'warn' : 'default', hint: 'Maliyet eksik hesaplanır' },
          { label: 'Gramajı girilmemiş', value: empty, tone: empty ? 'warn' : 'default' },
        ]}
      />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
        <Tabs value={cat} onChange={setCat} items={tabs} />
        <div className="relative lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="tc-input pl-9" placeholder="Reçete ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {costs.isLoading ? <Loading /> : costs.error ? <ErrorNote>Reçeteler yüklenemedi.</ErrorNote>
        : list.length === 0 ? (
          <div className="tc-card">
            <EmptyState icon={<BookOpenText className="w-5 h-5" />} title="Henüz reçete yok"
              action={canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => go('/receteler/yeni')}>İlk reçeteyi oluştur</Button>}>
              Önce hammaddeleri ekleyin, sonra 1 porsiyonun gramajını girerek reçeteyi oluşturun.
            </EmptyState>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((r) => (
              <Link key={r.recipe_id} to={`/receteler/${r.recipe_id}`}
                className={cx('tc-card p-4 block hover:ring-2 hover:ring-brand-soft transition', !r.active && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-brand">{catName(r.category_code)}</div>
                    <h3 className="text-base font-semibold text-ink truncate mt-0.5">{r.name}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <Money value={r.cost_last} className="text-lg font-bold text-ink" />
                    <div className="text-[10px] text-ink-3">/ porsiyon</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <Pill>{r.line_count} kalem</Pill>
                  {Number(r.total_net_g) > 0 && <Pill>{fmtNum(r.total_net_g, 0)} g net</Pill>}
                  {(r.missing_price_count ?? 0) > 0 && <Pill tone="wait">{r.missing_price_count} fiyat eksik</Pill>}
                  {!r.active && <Pill tone="stop">Pasif</Pill>}
                  {(r.allergens ?? []).slice(0, 3).map((a) => <Pill key={a} tone="accent">{ALLERGENS[a] ?? a}</Pill>)}
                </div>
              </Link>
            ))}
            {filtered.length === 0 && <p className="text-sm text-ink-3 col-span-full py-8 text-center">Filtreye uyan reçete yok.</p>}
          </div>
        )}
    </>
  );
}
