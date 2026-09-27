import { cx } from '@/ui/primitives';
import { tabPath, type ModuleDef, type TabDef } from './modules';
import { Link } from './router';

/** Modülün sekmeleri: masaüstünde yan yana, mobilde yatay kaydırılır (sayfa taşmaz). */
export function ModuleTabs({ mod, tabs, active }: { mod: ModuleDef; tabs: TabDef[]; active?: string }) {
  return (
    <nav aria-label={`${mod.label} sekmeleri`} className="tc-no-print -mx-4 sm:mx-0 mb-4 overflow-x-auto tc-scroll">
      <div className="flex gap-1.5 px-4 sm:px-0 w-max sm:w-auto">
        {tabs.map((t) => (
          <Link key={t.id} to={tabPath(mod, t)}
            className={cx('whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 transition',
              t.id === active ? 'bg-brand text-on-brand ring-brand' : 'bg-card text-ink-2 ring-line hover:text-ink hover:ring-ink-3/40')}>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
