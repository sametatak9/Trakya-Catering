import { ArrowRight, CheckCircle2, Circle, Clock3 } from 'lucide-react';
import { Link } from '@/app/router';
import { MODULES } from '@/app/modules';
import { useMember } from '@/app/session';
import { PRICE_STALE_DAYS } from '@/lib/domain';
import { daysSince, fmtDate } from '@/lib/format';
import { Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useIngredients, useMenuCosts, useRecipeCosts } from '../kitchen/api';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
}

export function DashboardPage() {
  const member = useMember();
  const ing = useIngredients();
  const rec = useRecipeCosts();
  const menus = useMenuCosts();

  if (ing.isLoading || rec.isLoading || menus.isLoading) return <Loading />;
  const ingredients = ing.data ?? [];
  const recipes = rec.data ?? [];
  const menuList = menus.data ?? [];

  const activeRecipes = recipes.filter((r) => r.active && (r.line_count ?? 0) > 0);
  const avgCost = activeRecipes.length ? activeRecipes.reduce((s, r) => s + Number(r.cost_last), 0) / activeRecipes.length : null;
  const priceIssues = ingredients
    .filter((i) => i.active && (i.last_price === null || (daysSince(i.price_updated_at) ?? 0) > PRICE_STALE_DAYS))
    .sort((a, b) => (a.price_updated_at ?? '').localeCompare(b.price_updated_at ?? ''));
  const expensive = [...activeRecipes].sort((a, b) => Number(b.cost_last) - Number(a.cost_last)).slice(0, 6);

  const steps = [
    { done: ingredients.length > 0, label: 'Hammadde kartlarını ekle', hint: 'birim + fire oranı', to: '/hammaddeler' },
    { done: ingredients.length > 0 && ingredients.every((i) => i.last_price !== null), label: 'Alış fiyatlarını gir', hint: 'maliyetin temeli', to: '/hammaddeler' },
    { done: activeRecipes.length > 0, label: 'Reçete gramajlarını gir', hint: '1 porsiyon net gramaj', to: '/receteler' },
    { done: menuList.length > 0, label: 'Menü kombinasyonlarını kur', hint: '3 kap / 4 kap', to: '/menuler' },
  ];
  const upcoming = MODULES.filter((m) => m.status === 'soon').sort((a, b) => (a.phase ?? 0) - (b.phase ?? 0));

  return (
    <>
      <ModuleHero
        kicker={new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${member.fullName.split(' ')[0]}`}
        description="Mutfak çekirdeğinin durumu. Sipariş, üretim ve sevkiyat modülleri açıldıkça yarının yemek sayıları ve eksik hammaddeler burada görünecek."
        stats={[
          { label: 'Aktif reçete', value: activeRecipes.length, hint: `${recipes.length} reçete kartı` },
          { label: 'Ort. porsiyon maliyeti', value: avgCost === null ? '—' : <Money value={avgCost} />, hint: 'son alış fiyatlarıyla' },
          { label: 'Hammadde', value: ingredients.length },
          { label: 'Fiyat bekleyen', value: priceIssues.length, tone: priceIssues.length ? 'warn' : 'good', hint: `yok veya ${PRICE_STALE_DAYS} günden eski` },
        ]}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="En yüksek porsiyon maliyetleri" subtitle="Menü fiyatlamasında ilk bakılacaklar" className="lg:col-span-2"
          action={<Link to="/receteler" className="text-xs font-semibold text-brand hover:underline">Tümü</Link>}>
          {expensive.length === 0 ? <p className="text-sm text-ink-3">Gramajı girilmiş reçete yok.</p> : (
            <ul className="space-y-2.5">
              {expensive.map((r) => {
                const max = Number(expensive[0].cost_last) || 1;
                return (
                  <li key={r.recipe_id}>
                    <Link to={`/receteler/${r.recipe_id}`} className="block group">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-ink group-hover:text-brand truncate">{r.name}</span>
                        <Money value={r.cost_last} className="font-semibold text-ink" />
                      </div>
                      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(Number(r.cost_last) / max) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Kurulum" subtitle="Maliyet motorunun doğru çalışması için">
          <ol className="space-y-1">
            {steps.map((s) => (
              <li key={s.label}>
                <Link to={s.to} className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-2">
                  {s.done ? <CheckCircle2 className="w-5 h-5 text-ok shrink-0" /> : <Circle className="w-5 h-5 text-line-strong shrink-0" />}
                  <div>
                    <div className={cx('text-sm font-medium', s.done ? 'text-ink-3 line-through' : 'text-ink')}>{s.label}</div>
                    <div className="text-[11px] text-ink-3">{s.hint}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Fiyat bekleyenler" subtitle="Eski fiyat = yanlış porsiyon maliyeti"
          action={<Link to="/hammaddeler" className="text-xs font-semibold text-brand hover:underline">Tümü</Link>}>
          {priceIssues.length === 0 ? <p className="text-sm text-ink-3">Tüm fiyatlar güncel.</p> : (
            <ul className="divide-y divide-line">
              {priceIssues.slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink truncate">{i.name}</span>
                  {i.last_price === null ? <Pill tone="wait">Fiyat yok</Pill> : <span className="text-xs text-wait">{fmtDate(i.price_updated_at)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Sıradaki modüller" subtitle="Yol haritası" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-2">
            {upcoming.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.path} className="flex items-center gap-3 rounded-xl ring-1 ring-line px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent-strong grid place-items-center"><Icon className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{m.label}</div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-3"><Clock3 className="w-3 h-3" />Faz {m.phase}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}

export function ComingSoon({ label, phase }: { label: string; phase?: number }) {
  return (
    <>
      <ModuleHero kicker={phase ? `Faz ${phase}` : 'Yakında'} title={label}
        description="Bu modül geliştirme planında. Sahte veri göstermiyoruz; modül açıldığında canlı veriyle çalışacak." />
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
        Komuta Merkezi’ne dön <ArrowRight className="w-4 h-4" />
      </Link>
    </>
  );
}
