import { useEffect, useState, type ReactNode } from 'react';
import { askConfirm } from '@/ui/confirm';
import { LogOut, Menu, Moon, RotateCcw, Sparkles, Sun, UserRound, X } from 'lucide-react';
import { NotificationBell } from '@/features/assistant/Notifications';
import { ChatButton } from '@/features/chat/ChatPanel';
import { DEMO, REAL_AVAILABLE, switchMode } from '@/lib/supabase';
import { Logo } from '@/ui/Logo';
import { cx } from '@/ui/primitives';
import { ROLE_LABELS } from '@/lib/domain';
import { GROUP_LABELS, activeModule, visibleModules, type ModuleDef } from './modules';
import { Link, useRouter } from './router';
import { signOut, useMember } from './session';
import { applyTheme, readTheme, type Theme } from './theme';

function NavItem({ m, active, onNavigate }: { m: ModuleDef; active: boolean; onNavigate?: () => void }) {
  const Icon = m.icon;
  const body = (
    <>
      <Icon className={cx('w-[18px] h-[18px] shrink-0', active ? 'text-brand' : 'text-ink-3 group-hover:text-ink-2')} />
      <span className="flex-1 min-w-0">
        <span className="block truncate">{m.label}</span>
        <span className={cx('block truncate text-[11px] font-normal', active ? 'text-ink-2' : 'text-ink-3')}>{m.hint}</span>
      </span>
    </>
  );
  const cls = cx(
    'group flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition',
    active ? 'bg-brand-soft text-ink font-semibold' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  );
  return (
    <div onClick={onNavigate}>
      <Link to={m.path} className={cls}>{body}</Link>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const member = useMember();
  const { path } = useRouter();
  const current = activeModule(path);
  const mods = visibleModules(member.role);
  const groups = (Object.keys(GROUP_LABELS) as ModuleDef['group'][])
    .map((g) => ({ g, items: mods.filter((m) => m.group === g) }))
    .filter((x) => x.items.length > 0);

  return (
    <nav className="flex flex-col gap-5" aria-label="Ana menü">
      {groups.map(({ g, items }) => (
        <div key={g}>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">{GROUP_LABELS[g]}</div>
          <div className="flex flex-col gap-0.5">
            {items.map((m) => <NavItem key={m.path} m={m} active={current?.path === m.path} onNavigate={onNavigate} />)}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <Logo size={36} />
      <div className="leading-tight">
        <div className="font-display font-extrabold text-[15px] tracking-tight text-ink">TRAKYA CATERING</div>
        <div className="text-[11px] text-ink-3">Üretim & Maliyet ERP</div>
      </div>
    </Link>
  );
}

function UserBox({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const member = useMember();
  const initials = member.fullName.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2 p-2.5">
      <div className="w-9 h-9 rounded-xl bg-accent text-ink grid place-items-center text-xs font-bold">{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink truncate">{member.fullName}</div>
        <div className="text-[11px] text-ink-3">{ROLE_LABELS[member.role]}</div>
      </div>
      <button type="button" onClick={onToggleTheme} className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-card"
        aria-label={theme === 'dark' ? 'Açık tema' : 'Koyu tema'} title={theme === 'dark' ? 'Açık tema' : 'Koyu tema'}>
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <button type="button" onClick={() => void signOut()} className="p-1.5 rounded-lg text-ink-3 hover:text-stop hover:bg-card"
        aria-label="Çıkış" title="Çıkış">
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Demo sürümünde her ekranda görünen küçük şerit: verilerin örnek olduğunu hatırlatır. */
function DemoBadge() {
  const reset = async () => {
    if (!await askConfirm('Demo verileri ilk hâline dönsün mü? Yaptığınız değişiklikler silinir.')) return;
    (await import('@/demo/server')).resetDemo();
    window.location.reload();
  };
  return (
    <div className="tc-no-print fixed bottom-3 left-1/2 -translate-x-1/2 lg:left-[calc(50%+132px)] z-30 flex items-center gap-1 rounded-full bg-ink/90 text-surface backdrop-blur pl-3 pr-1 py-1 shadow-xl text-[11.5px]">
      <Sparkles className="w-3.5 h-3.5 text-accent" />
      <span className="font-semibold">DEMO</span>
      <span className="hidden sm:inline opacity-75">· tüm veriler örnektir</span>
      <button type="button" onClick={() => void signOut()} className="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/10" title="Başka bir rolle bak">
        <UserRound className="w-3.5 h-3.5" /> Rol değiştir
      </button>
      <button type="button" onClick={() => void reset()} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/10" title="Örnek verileri sıfırla">
        <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sıfırla</span>
      </button>
      {REAL_AVAILABLE && (
        <button type="button" onClick={() => switchMode('canli')} className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/10" title="Gerçek sisteme geç">
          <LogOut className="w-3.5 h-3.5" /> Demodan çık
        </button>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [drawer, setDrawer] = useState(false);
  const { path } = useRouter();
  const current = activeModule(path);

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { setDrawer(false); }, [path]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <div className="min-h-dvh bg-surface">
      {/* Masaüstü kenar çubuğu */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col border-r border-line bg-card">
        <div className="px-5 pt-5 pb-4"><Brand /></div>
        <div className="flex-1 overflow-y-auto tc-scroll px-3 pb-4"><Sidebar /></div>
        <div className="p-3 border-t border-line"><UserBox theme={theme} onToggleTheme={toggle} /></div>
      </aside>

      {/* Mobil üst bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-line">
        <Brand />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ChatButton />
          <button type="button" onClick={() => setDrawer(true)} className="p-2 rounded-xl ring-1 ring-line text-ink-2" aria-label="Menü">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button type="button" aria-label="Menüyü kapat" className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-card flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-line">
              <Brand />
              <button type="button" onClick={() => setDrawer(false)} className="p-2 text-ink-3" aria-label="Kapat"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto tc-scroll px-3 py-4"><Sidebar onNavigate={() => setDrawer(false)} /></div>
            <div className="p-3 border-t border-line"><UserBox theme={theme} onToggleTheme={toggle} /></div>
          </div>
        </div>
      )}

      <main className="lg:pl-[264px]">
        {/* Masaüstü üst şerit: bulunduğunuz ekran + bildirim + sohbet */}
        <div className="hidden lg:block sticky top-0 z-30 bg-surface/85 backdrop-blur border-b border-line/70">
          <div className="mx-auto max-w-[1400px] px-8 py-2.5 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-ink-3 truncate">{current ? `${current.label} · ${current.hint}` : ''}</div>
            <div className="flex items-center gap-2"><NotificationBell /><ChatButton /></div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-7" key={current?.path}>
          {children}
        </div>
      </main>
      {DEMO && <DemoBadge />}
    </div>
  );
}
