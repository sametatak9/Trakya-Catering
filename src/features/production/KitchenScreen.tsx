import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CircleCheckBig, Volume2 } from 'lucide-react';
import { useCan } from '@/app/session';
import { todayISO, dayLabel } from '@/lib/dates';
import { ROLES } from '@/lib/domain';
import { fmtNum } from '@/lib/format';
import { COURSE_LABELS, COURSE_ORDER, type Course } from '@/lib/prep';
import { Loading, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useRecipe } from '../kitchen/api';
import { usePrepBatches, usePrepItems, useSaveBatch, type PrepBatchCost, type PrepItem } from './api';

// Mutfak ekranı: tablette/duvar ekranında, okuma yazması zayıf personel için.
// Büyük yazı, resimli simgeler, tek seferde tek iş, sesli okuma.

const COURSE_EMOJI: Record<string, string> = {
  corba: '🍲', ana: '🍖', yardimci: '🍚', salata: '🥗', meze: '🥣', tatli: '🍮', icecek: '🫖', ekmek: '🍞', kahvalti: '🧀',
};
const MEAL_BUTTONS: Array<[string, string, string]> = [['kahvalti', '☀️', 'Kahvaltı'], ['ogle', '🍽️', 'Öğle'], ['aksam', '🌙', 'Akşam']];

/** Miktarı mutfak diline çevirir: 240.949 kg → "241 kg", 0.43 kg → "430 gram" */
export function kitchenQty(qty: number, unit: string): string {
  if (unit === 'kg') return qty >= 1 ? `${fmtNum(qty, qty >= 20 ? 0 : 1)} kg` : `${fmtNum(qty * 1000, 0)} gram`;
  if (unit === 'lt') return qty >= 1 ? `${fmtNum(qty, qty >= 20 ? 0 : 1)} litre` : `${fmtNum(qty * 1000, 0)} ml`;
  if (unit === 'g') return qty >= 1000 ? `${fmtNum(qty / 1000, 1)} kg` : `${fmtNum(qty, 0)} gram`;
  if (unit === 'ml') return qty >= 1000 ? `${fmtNum(qty / 1000, 1)} litre` : `${fmtNum(qty, 0)} ml`;
  return `${fmtNum(Math.ceil(qty), 0)} adet`;
}

function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR'; u.rate = 0.92;
    window.speechSynthesis.speak(u);
  } catch { /* ses yoksa sessiz geç */ }
}

const checksKey = (batchId: string) => `tc_kitchen_checks_${batchId}`;
function readChecks(batchId: string): string[] {
  try { return JSON.parse(localStorage.getItem(checksKey(batchId)) ?? '[]') as string[]; } catch { return []; }
}

export function KitchenScreen() {
  const date = todayISO();
  const [meal, setMeal] = useState(() => (new Date().getHours() < 10 ? 'kahvalti' : 'ogle'));
  const [openId, setOpenId] = useState<string | null>(null);
  const batches = usePrepBatches(date, date);
  const list = (batches.data ?? [])
    .filter((b) => b.meal === meal)
    .sort((a, b) => COURSE_ORDER.indexOf(a.course as Course) - COURSE_ORDER.indexOf(b.course as Course));
  const open = list.find((b) => b.batch_id === openId) ?? null;

  if (open) return <DishFlow batch={open} onBack={() => setOpenId(null)} />;

  const done = list.filter((b) => b.status !== 'taslak').length;
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div className="text-sm font-bold uppercase tracking-widest text-brand">Mutfak ekranı</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink mt-1">{dayLabel(date)}</h1>
          <div className="text-lg text-ink-2 mt-1">{list.length > 0 ? `${done} / ${list.length} yemek hazır` : 'Bugün yemek girilmedi'}</div>
        </div>
        <div className="flex gap-2">
          {MEAL_BUTTONS.map(([id, emoji, label]) => (
            <button key={id} type="button" onClick={() => setMeal(id)}
              className={cx('rounded-2xl px-4 py-3 text-lg font-bold ring-2 transition', meal === id ? 'bg-brand text-on-brand ring-brand' : 'bg-card text-ink ring-line hover:ring-brand/50')}>
              <span className="mr-1.5" aria-hidden>{emoji}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {batches.isLoading ? <Loading /> : list.length === 0 ? (
        <div className="tc-card p-10 text-center">
          <div className="text-6xl" aria-hidden>🧑‍🍳</div>
          <div className="text-2xl font-bold text-ink mt-3">Bu öğün için iş yok</div>
          <div className="text-lg text-ink-3 mt-1">Aşçıbaşı “Günlük Hazırlık” ekranından yemekleri getirince burada görünür.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((b) => {
            const ready = b.status !== 'taslak';
            return (
              <button key={b.batch_id} type="button" onClick={() => setOpenId(b.batch_id!)}
                className={cx('tc-card text-left p-5 transition hover:-translate-y-0.5 hover:shadow-xl ring-2', ready ? 'ring-ok/60' : 'ring-transparent')}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-6xl leading-none" aria-hidden>{COURSE_EMOJI[b.course ?? 'ana'] ?? '🍽️'}</span>
                  {ready
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-ok text-white px-3 py-1.5 text-base font-bold"><Check className="w-5 h-5" /> Hazır</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-wait-soft text-wait px-3 py-1.5 text-base font-bold">⏳ Yapılıyor</span>}
                </div>
                <div className="text-2xl font-extrabold text-ink mt-4 leading-tight">{b.dish_name}</div>
                <div className="text-base text-ink-3 mt-0.5">{COURSE_LABELS[b.course as Course]}</div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="tc-num text-5xl font-extrabold text-brand">{fmtNum(b.portions, 0)}</span>
                  <span className="text-xl font-bold text-ink-2">kişi</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DishFlow({ batch, onBack }: { batch: PrepBatchCost; onBack: () => void }) {
  const toast = useToast();
  const canMark = useCan(ROLES.production);
  const items = usePrepItems([batch.batch_id!]);
  const recipe = useRecipe(batch.recipe_id);
  const save = useSaveBatch();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checked, setChecked] = useState<string[]>(() => readChecks(batch.batch_id!));
  const [cookStep, setCookStep] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(checksKey(batch.batch_id!), JSON.stringify(checked)); } catch { /* yok say */ }
  }, [checked, batch.batch_id]);

  const rows: PrepItem[] = useMemo(() => [...(items.data ?? [])].sort((a, b) => Number(a.sort) - Number(b.sort)), [items.data]);
  const steps = (recipe.data?.instructions ?? '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const toggle = (id: string) => setChecked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const allChecked = rows.length > 0 && rows.every((r) => checked.includes(r.id!));
  const ready = batch.status !== 'taslak';

  const markReady = async () => {
    try {
      await save.mutateAsync({ id: batch.batch_id!, draft: { status: 'pisti' } });
      toast.ok(`${batch.dish_name} hazır olarak işaretlendi`);
      speak(`${batch.dish_name} hazır. Eline sağlık.`);
      onBack();
    } catch (e) { toast.error(e); }
  };

  const StepDot = ({ n, label }: { n: 1 | 2 | 3; label: string }) => (
    <button type="button" onClick={() => setStep(n)} className="flex flex-col items-center gap-1.5 min-w-0">
      <span className={cx('w-14 h-14 rounded-full grid place-items-center text-2xl font-extrabold ring-4 transition',
        step === n ? 'bg-brand text-on-brand ring-brand-soft' : step > n ? 'bg-ok text-white ring-ok-soft' : 'bg-card text-ink-3 ring-line')}>
        {step > n ? <Check className="w-7 h-7" /> : n}
      </span>
      <span className={cx('text-base font-bold', step === n ? 'text-ink' : 'text-ink-3')}>{label}</span>
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-2xl bg-card ring-2 ring-line px-4 py-3 text-lg font-bold text-ink hover:ring-brand/50">
        <ArrowLeft className="w-6 h-6" /> Yemekler
      </button>

      <div className="tc-card tc-holo-in mt-4 p-5 sm:p-6 flex items-center gap-4">
        <span className="text-6xl" aria-hidden>{COURSE_EMOJI[batch.course ?? 'ana'] ?? '🍽️'}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink leading-tight">{batch.dish_name}</h1>
          <div className="text-xl text-ink-2 mt-1"><b className="tc-num text-brand text-3xl">{fmtNum(batch.portions, 0)}</b> kişi</div>
        </div>
        <button type="button" onClick={() => speak(`${batch.dish_name}. ${fmtNum(batch.portions, 0)} kişi.`)} className="p-3 rounded-2xl bg-brand-soft text-brand" aria-label="Sesli oku">
          <Volume2 className="w-7 h-7" />
        </button>
      </div>

      <div className="flex justify-around mt-6 mb-5">
        <StepDot n={1} label="Malzeme" />
        <StepDot n={2} label="Pişir" />
        <StepDot n={3} label="Bitti" />
      </div>

      {step === 1 && (
        <div className="tc-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line bg-surface-2">
            <div className="text-xl font-extrabold text-ink">🧺 Malzemeleri hazırla</div>
            <div className="tc-num text-xl font-bold text-ink-2">{checked.filter((c) => rows.some((r) => r.id === c)).length} / {rows.length}</div>
          </div>
          {items.isLoading ? <Loading /> : rows.length === 0 ? (
            <div className="p-8 text-center text-lg text-ink-3">Malzeme girilmemiş. Aşçıbaşına haber verin.</div>
          ) : (
            <ul>
              {rows.map((r) => {
                const on = checked.includes(r.id!);
                const qtyText = kitchenQty(Number(r.qty), r.unit ?? 'kg');
                return (
                  <li key={r.id} className="border-b border-line last:border-0">
                    <div className={cx('w-full flex items-center gap-4 px-5 py-4 transition', on ? 'bg-ok-soft' : 'hover:bg-surface-2')}>
                      <button type="button" onClick={() => toggle(r.id!)} aria-pressed={on} aria-label={`${r.item_name} hazır`}
                        className={cx('w-12 h-12 shrink-0 rounded-2xl grid place-items-center ring-2', on ? 'bg-ok text-white ring-ok' : 'bg-card ring-line-strong')}>
                        {on && <Check className="w-8 h-8" />}
                      </button>
                      <button type="button" onClick={() => toggle(r.id!)} className="flex-1 min-w-0 text-left">
                        <span className={cx('block text-xl font-bold', on ? 'text-ok line-through decoration-2' : 'text-ink')}>{r.item_name}</span>
                        {r.is_side && <span className="text-sm text-ink-3">yan malzeme</span>}
                      </button>
                      <span className="tc-num text-2xl sm:text-3xl font-extrabold text-ink whitespace-nowrap">{qtyText}</span>
                      <button type="button" onClick={() => speak(`${r.item_name}, ${qtyText}`)} className="p-2 rounded-xl text-ink-3 hover:text-brand" aria-label="Sesli oku">
                        <Volume2 className="w-6 h-6" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="p-4 border-t border-line">
            <button type="button" onClick={() => setStep(2)}
              className={cx('w-full rounded-2xl py-4 text-xl font-extrabold inline-flex items-center justify-center gap-2', allChecked ? 'tc-holo' : 'bg-brand text-on-brand')}>
              {allChecked ? 'Hepsi hazır — Pişirmeye geç' : 'Pişirmeye geç'} <ChevronRight className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="tc-card p-5 sm:p-6">
          {steps.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-6xl" aria-hidden>🔥</div>
              <div className="text-2xl font-bold text-ink mt-3">Tarif yazılmamış</div>
              <div className="text-lg text-ink-3">Aşçıbaşının anlattığı gibi pişirin.</div>
            </div>
          ) : (
            <div key={cookStep} className="tc-holo-in">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-brand">Adım {cookStep + 1} / {steps.length}</span>
                <button type="button" onClick={() => speak(steps[cookStep])} className="inline-flex items-center gap-2 rounded-2xl bg-brand-soft text-brand px-4 py-2.5 text-lg font-bold">
                  <Volume2 className="w-6 h-6" /> Oku
                </button>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-ink leading-snug mt-5 min-h-[120px]">{steps[cookStep]}</p>
              <div className="flex gap-1.5 mt-6">{steps.map((_, i) => <span key={i} className={cx('h-2.5 flex-1 rounded-full', i <= cookStep ? 'bg-brand' : 'bg-line')} />)}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button type="button" onClick={() => (cookStep > 0 ? setCookStep(cookStep - 1) : setStep(1))}
              className="rounded-2xl py-4 text-xl font-bold ring-2 ring-line bg-card text-ink inline-flex items-center justify-center gap-1">
              <ChevronLeft className="w-7 h-7" /> Geri
            </button>
            <button type="button" onClick={() => (cookStep < steps.length - 1 ? setCookStep(cookStep + 1) : setStep(3))}
              className="rounded-2xl py-4 text-xl font-extrabold bg-brand text-on-brand inline-flex items-center justify-center gap-1">
              {cookStep < steps.length - 1 ? 'Sonraki adım' : 'Bitti'} <ChevronRight className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="tc-card p-6 text-center">
          <div className="text-7xl" aria-hidden>{ready ? '✅' : '👨‍🍳'}</div>
          <div className="text-3xl font-extrabold text-ink mt-3">{ready ? 'Bu yemek hazır' : 'Yemek hazır mı?'}</div>
          <div className="text-lg text-ink-3 mt-1">{fmtNum(batch.portions, 0)} kişilik {batch.dish_name}</div>
          {!ready && canMark && (
            <button type="button" onClick={markReady} disabled={save.isPending}
              className="mt-6 w-full rounded-3xl py-6 text-2xl font-extrabold bg-ok text-white inline-flex items-center justify-center gap-3 shadow-lg disabled:opacity-60">
              <CircleCheckBig className="w-9 h-9" /> EVET, HAZIR
            </button>
          )}
          {!ready && !canMark && <div className="mt-5 text-lg text-ink-2">Aşçıbaşına “hazır” deyin; o işaretler.</div>}
        </div>
      )}
    </div>
  );
}
