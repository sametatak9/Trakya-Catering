import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChefHat, RotateCcw, Scale, Sparkles } from 'lucide-react';
import { askConfirm } from '@/ui/confirm';
import { useCan } from '@/app/session';
import { fmtNum, fmtQty } from '@/lib/format';
import { calibrationSummary } from '@/lib/calibration';
import { useRecipeCosts, useRecipeLines } from '@/features/kitchen/api';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useApplyCalibration, useRecipeCalibrations, useSetCalibrationIncluded } from './ordersApi';

function readableBase(value: number | null, unit: string | null) {
  if (value === null) return '—';
  const base = unit === 'g' || unit === 'kg' ? 'g' : unit === 'ml' || unit === 'lt' ? 'ml' : 'adet';
  if (base === 'g' && Math.abs(value) >= 1000) return `${fmtNum(value / 1000, 2)} kg`;
  if (base === 'ml' && Math.abs(value) >= 1000) return `${fmtNum(value / 1000, 2)} lt`;
  return fmtQty(value, base);
}

export function CalibrationPage() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'asci_basi', 'diyetisyen']);
  const [recipeId, setRecipeId] = useState('');
  const [ingredientId, setIngredientId] = useState('');
  const recipes = useRecipeCosts();
  const selectedId = recipeId || recipes.data?.find((row) => row.recipe_id)?.recipe_id || null;
  const selected = recipes.data?.find((row) => row.recipe_id === selectedId);
  const lines = useRecipeLines(selectedId);
  const calibrations = useRecipeCalibrations(selectedId);
  const setIncluded = useSetCalibrationIncluded();
  const apply = useApplyCalibration();

  const samplesByIngredient = useMemo(() => {
    const map = new Map<string, NonNullable<typeof calibrations.data>>();
    for (const sample of calibrations.data ?? []) {
      map.set(sample.ingredient_id, [...(map.get(sample.ingredient_id) ?? []), sample]);
    }
    return map;
  }, [calibrations.data]);

  const includedSamples = (calibrations.data ?? []).filter((sample) => sample.included && sample.per_portion_base !== null);
  const productionBatches = new Map<string, number>();
  for (const sample of includedSamples) {
    if (sample.prep_batch_id) productionBatches.set(sample.prep_batch_id, Number(sample.portions));
  }
  const measuredIngredients = new Set(includedSamples.map((sample) => sample.ingredient_id)).size;
  const totalMeasuredPortions = [...productionBatches.values()].reduce((sum, count) => sum + count, 0);
  const trendLine = (lines.data ?? []).find((line) => line.ingredient_id === ingredientId) ?? lines.data?.[0];
  const trendSamples = (samplesByIngredient.get(trendLine?.ingredient_id ?? '') ?? [])
    .filter((sample) => sample.included && sample.per_portion_base !== null)
    .slice().sort((a, b) => a.prep_date.localeCompare(b.prep_date)).slice(-8);
  const trendMaximum = Math.max(1, ...trendSamples.map((sample) => Number(sample.per_portion_base ?? 0)));

  const toggle = async (id: string, included: boolean) => {
    if (!selectedId) return;
    try {
      await setIncluded.mutateAsync({ id, recipeId: selectedId, included });
      toast.ok(included ? 'Üretim ölçümü kalibrasyona dahil edildi' : 'Üretim ölçümü hariç tutuldu');
    } catch (error) { toast.error(error); }
  };

  const applyToRecipe = async () => {
    if (!selectedId) return;
    const hasSuggestion = (lines.data ?? []).some((line) => line.ingredient_id && line.net_qty !== null)
      && (calibrations.data ?? []).some((sample) => sample.included && sample.per_portion_base !== null);
    if (!hasSuggestion) return toast.error('Uygulanabilir kalibrasyon önerisi bulunamadı');
    if (!(await askConfirm('Güncel dahil/hariç seçimleriyle kalibrasyon medyanı yeniden hesaplanacak; uygun öneriler kilitli olmayan reçete gramajlarına yazılacak ve maliyet geçmişine kaydedilecek. Eski üretim ölçümleri saklanır. Devam edilsin mi?'))) return;
    try {
      const count = await apply.mutateAsync(selectedId);
      toast.ok(`${fmtNum(count, 0)} malzeme reçeteye uygulandı`);
    } catch (error) { toast.error(error); }
  };

  const noRecipes = !recipes.isLoading && (recipes.data ?? []).length === 0;
  return (
    <div>
      <ModuleHero
        kicker="Mutfak · Gerçek üretimden öğrenen reçete"
        title="Gramaj Kalibrasyonu"
        description="Üretim kapandığında ölçülen gerçek tüketimler saklanır. Aykırı kayıtları dışarıda tutun; kişi başı öneriyi inceleyip reçeteye uygulayın."
        actions={<Button variant="holo" icon={<Sparkles className="h-4 w-4" />} onClick={applyToRecipe} disabled={!selectedId || !canEdit || apply.isPending} loading={apply.isPending}>Öneriyi reçeteye uygula</Button>}
        stats={[
          { label: 'Ölçülen üretim partisi', value: fmtNum(productionBatches.size, 0), hint: `${fmtNum(totalMeasuredPortions, 0)} porsiyonluk ölçüm`, tone: productionBatches.size ? 'good' : 'default' },
          { label: 'Hariç tutulan malzeme ölçümü', value: fmtNum((calibrations.data ?? []).filter((sample) => !sample.included).length, 0), hint: 'Geçmişte saklanır; medyana katılmaz' },
          { label: 'Malzeme satırı', value: fmtNum(lines.data?.length ?? 0, 0), hint: selected?.name ?? 'Reçete seçin' },
          { label: 'Kalibrasyon önerisi', value: fmtNum(measuredIngredients, 0), hint: 'Malzemede ayrı ayrı hesaplanır', tone: measuredIngredients ? 'good' : 'warn' },
        ]}
      />

      <Panel title="Reçete seçin" subtitle="Ölçümler tarih, porsiyon sayısı ve dahil/hariç bilgisiyle saklanır." className="mb-4">
        {recipes.isLoading ? <Loading label="Reçeteler yükleniyor…" /> : recipes.error ? <ErrorNote>Reçete listesi yüklenemedi.</ErrorNote> : noRecipes ? (
          <EmptyState icon={<ChefHat className="h-5 w-5" />} title="Henüz reçete yok">Önce Reçeteler ekranından bir reçete oluşturun veya Günlük Üretim ekranında hazırlıktan reçete kaydedin.</EmptyState>
        ) : <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_auto] sm:items-end">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-2">Yemek</span>
            <select className="tc-input" value={selectedId ?? ''} onChange={(event) => setRecipeId(event.target.value)}>
              {(recipes.data ?? []).filter((row) => row.recipe_id).map((recipe) => <option key={recipe.recipe_id} value={recipe.recipe_id!}>{recipe.name}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2 text-xs text-ink-3"><Scale className="h-4 w-4 text-brand" />Tüm miktarlar stok birimine çevrilip porsiyon başına normalleştirilir.</div>
        </div>}
      </Panel>

      {!noRecipes && selectedId && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
          <div className="space-y-4 min-w-0">
            <Panel title="Malzeme bazında öneri" subtitle="Mevcut reçete gramajı ile üretim ölçümlerinden çıkan kişi başı değer karşılaştırılır.">
              {lines.isLoading || calibrations.isLoading ? <Loading label="Reçete ve ölçümler yükleniyor…" />
                : lines.error || calibrations.error ? <ErrorNote>Kalibrasyon bilgisi yüklenemedi.</ErrorNote>
                  : (lines.data ?? []).length === 0 ? <EmptyState icon={<Scale className="h-5 w-5" />} title="Reçetede malzeme satırı yok">Ölçüm önerisi için önce reçeteye malzeme ekleyin.</EmptyState>
                    : <div className="overflow-x-auto -mx-2 sm:mx-0"><table className="w-full min-w-[600px] text-sm">
                      <thead><tr className="border-b border-line text-[11px] text-ink-3"><th className="px-2 py-2 text-left">Malzeme</th><th className="px-2 py-2 text-right">Reçete (net)</th><th className="px-2 py-2 text-right">Ölçüm medyanı</th><th className="px-2 py-2 text-right">Kayıt</th><th className="px-2 py-2 text-right">Sapma</th></tr></thead>
                      <tbody>{(lines.data ?? []).map((line) => {
                        const samples = samplesByIngredient.get(line.ingredient_id ?? '') ?? [];
                        const rowSummary = calibrationSummary(samples.map((sample) => ({ perPortionBase: sample.per_portion_base === null ? null : Number(sample.per_portion_base), portions: Number(sample.portions), included: sample.included })));
                        const current = line.net_qty === null ? null : Number(line.net_qty);
                        const deviation = current && rowSummary.median !== null ? ((rowSummary.median - current) / current) * 100 : null;
                        const tone = deviation !== null && Math.abs(deviation) >= 25 ? 'text-wait' : 'text-ink-3';
                        return <tr key={line.ingredient_id ?? line.id} className="border-b border-line last:border-0">
                          <td className="px-2 py-3 font-medium text-ink"><button type="button" onClick={() => setIngredientId(line.ingredient_id ?? '')} className="text-left hover:text-brand focus-visible:underline">{line.ingredient_name ?? 'Malzeme'}</button>{line.waste_pct ? <span className="ml-1 text-[10px] text-ink-3">· {fmtNum(Number(line.waste_pct), 0)}% fire</span> : null}</td>
                          <td className="tc-num px-2 py-3 text-right">{readableBase(current, line.base_unit)}</td>
                          <td className="tc-num px-2 py-3 text-right font-semibold text-brand">{readableBase(rowSummary.median, line.base_unit)}</td>
                          <td className="px-2 py-3 text-right"><Pill tone={rowSummary.includedCount ? 'ok' : 'idle'}>{rowSummary.includedCount} dahil</Pill></td>
                          <td className={cx('tc-num px-2 py-3 text-right', tone)}>{deviation === null ? '—' : `${deviation > 0 ? '+' : ''}${fmtNum(deviation, 1)}%`}</td>
                        </tr>;
                      })}</tbody>
                    </table></div>}
              {trendLine && <div className="mt-4 rounded-2xl bg-surface-2/70 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><div className="text-sm font-semibold text-ink">{trendLine.ingredient_name ?? 'Malzeme'} · son üretimler</div><div className="text-[11px] text-ink-3">Kişi başı · {trendLine.base_unit ?? 'stok birimi'}</div></div>
                {trendSamples.length ? <div role="img" aria-label={`${trendLine.ingredient_name ?? 'Malzeme'} kişi başı ölçüm trendi`} className="mt-3 flex h-24 items-end gap-2">
                  {trendSamples.map((sample) => <div key={sample.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${new Date(`${sample.prep_date}T12:00:00`).toLocaleDateString('tr-TR')}: ${readableBase(Number(sample.per_portion_base), trendLine.base_unit)}`}>
                    <div className="w-full rounded-t-md bg-brand/75 hover:bg-brand" style={{ height: `${Math.max(7, Number(sample.per_portion_base) / trendMaximum * 82)}%` }} />
                    <span className="text-[9px] text-ink-3">{new Date(`${sample.prep_date}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>)}
                </div> : <p className="mt-2 text-xs text-ink-3">Bu malzemede dahil edilen üretim ölçümü yok.</p>}
              </div>}
            </Panel>

            <Panel title="Üretim ölçüm geçmişi" subtitle={`${selected?.name ?? 'Reçete'} · son 120 kapanış ölçümü`} action={<Pill tone="info">{calibrations.data?.length ?? 0} kayıt</Pill>}>
              {calibrations.isLoading ? <Loading /> : calibrations.error ? <ErrorNote>Ölçüm geçmişi yüklenemedi.</ErrorNote>
                : (calibrations.data ?? []).length === 0 ? <EmptyState icon={<RotateCcw className="h-5 w-5" />} title="Henüz kapanmış üretim ölçümü yok">Üretim emrini kapattığınızda gerçek malzeme kullanımı burada reçeteyle karşılaştırılır.</EmptyState>
                  : <div className="overflow-x-auto -mx-2 sm:mx-0"><table className="w-full min-w-[640px] text-sm">
                    <thead><tr className="border-b border-line text-[11px] text-ink-3"><th className="px-2 py-2 text-left">Tarih</th><th className="px-2 py-2 text-left">Malzeme</th><th className="px-2 py-2 text-right">Porsiyon</th><th className="px-2 py-2 text-right">Toplam tüketim</th><th className="px-2 py-2 text-right">Kişi başı</th><th className="px-2 py-2 text-right">Durum</th></tr></thead>
                    <tbody>{(calibrations.data ?? []).map((sample) => {
                      const line = (lines.data ?? []).find((candidate) => candidate.ingredient_id === sample.ingredient_id);
                      return <tr key={sample.id} className="border-b border-line last:border-0">
                        <td className="px-2 py-3 text-ink-2">{new Date(`${sample.prep_date}T12:00:00`).toLocaleDateString('tr-TR')}</td>
                        <td className="px-2 py-3 font-medium text-ink">{line?.ingredient_name ?? 'Malzeme'}</td>
                        <td className="tc-num px-2 py-3 text-right">{fmtNum(Number(sample.portions), 0)}</td>
                        <td className="tc-num px-2 py-3 text-right">{readableBase(Number(sample.used_qty_base), line?.base_unit ?? null)}</td>
                        <td className="tc-num px-2 py-3 text-right">{readableBase(sample.per_portion_base === null ? null : Number(sample.per_portion_base), line?.base_unit ?? null)}</td>
                        <td className="px-2 py-3 text-right">{sample.included
                          ? <button type="button" onClick={() => toggle(sample.id, false)} disabled={!canEdit || setIncluded.isPending} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-ok-soft px-2.5 text-[11px] font-semibold text-ok hover:ring-1 hover:ring-ok" aria-label={`${line?.ingredient_name ?? 'Ölçüm'} kaydını hariç tut`}><Check className="h-3.5 w-3.5" />Dahil · çıkar</button>
                          : <button type="button" onClick={() => toggle(sample.id, true)} disabled={!canEdit || setIncluded.isPending} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-[11px] font-semibold text-ink-3 hover:ring-1 hover:ring-brand" aria-label={`${line?.ingredient_name ?? 'Ölçüm'} kaydını dahil et`}><AlertTriangle className="h-3.5 w-3.5" />Hariç · geri al</button>}</td>
                      </tr>;
                    })}</tbody>
                  </table></div>}
            </Panel>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4">
            <Panel title="Öneri özeti" subtitle="Ağırlıklı medyan her malzeme için, kendi stok biriminde hesaplanır.">
              {measuredIngredients === 0 ? <div className="rounded-xl bg-accent-soft/60 p-3 text-sm text-ink-2">Uygun ölçüm yok. Üretim geçmişi oluşunca her malzeme için ayrı öneri görünür.</div>
                : <div className="tc-holo-border rounded-2xl bg-card p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Ölçümü olan malzeme</div>
                  <div className="tc-num mt-1 text-3xl font-bold text-brand">{fmtNum(measuredIngredients, 0)} <span className="text-base">/ {fmtNum(lines.data?.length ?? 0)}</span></div>
                  <div className="mt-1 text-xs text-ink-3">Her öneri yalnız kendi malzemesinin üretimleriyle karşılaştırılır.</div>
                </div>}
              <Button className="mt-4 w-full" variant="holo" icon={<Sparkles className="h-4 w-4" />} onClick={applyToRecipe} disabled={!canEdit || !measuredIngredients || apply.isPending} loading={apply.isPending}>Öneriyi reçeteye uygula</Button>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-3">Uygulama öncesi onay sorulur; reçete maliyet geçmişine yeni sürüm notu düşer. Hariç kayıt silinmez.</p>
            </Panel>
            {(calibrations.data ?? []).some((sample) => !sample.included) && <Panel title="Hariç tutulan ölçümler" subtitle="Denetim için geçmişte saklanır."><div className="text-sm text-ink-2">{fmtNum((calibrations.data ?? []).filter((sample) => !sample.included).length, 0)} kayıt medyana katılmıyor.</div></Panel>}
          </aside>
        </div>
      )}
    </div>
  );
}
