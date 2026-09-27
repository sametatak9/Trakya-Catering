import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Calculator, ChefHat, Clock3, Crown, KeyRound, LogOut, Megaphone, Salad, ShoppingCart, Sparkles, Truck, Warehouse } from 'lucide-react';
import { DEMO_USERS, demoEmail } from '@/demo/users';
import { ROLE_LABELS, type AppRole } from '@/lib/domain';
import { DEMO, supabase, supabaseConfigured } from '@/lib/supabase';
import { LogoFull } from '@/ui/Logo';
import { Button, ErrorNote, Field } from '@/ui/primitives';
import { signOut } from './session';

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-surface">
      {/* Marka paneli */}
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 bg-brand text-on-brand">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#FBF8F2] px-4 py-2 shadow-sm"><LogoFull height={56} /></div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">Reçeteden faturaya,<br />her porsiyonun hesabı.</h1>
          <p className="mt-4 text-[15px] opacity-85">Gramaj, fire, hammadde ihtiyacı, sevkiyat ve gerçek porsiyon maliyeti — tek yerde.</p>
        </div>
        <div className="text-xs opacity-70">Toplu yemek üretim ERP</div>
        {/* Ayçiçeği tarlası dokusu */}
        <svg className="absolute -right-24 -bottom-24 w-[520px] h-[520px] opacity-[0.16]" viewBox="0 0 200 200" aria-hidden="true">
          <g fill="var(--tc-accent)" transform="translate(100 100)">
            {Array.from({ length: 16 }).map((_, i) => (
              <ellipse key={i} rx="11" ry="40" cy="-58" transform={`rotate(${i * 22.5})`} />
            ))}
            <circle r="30" fill="#221F1B" />
          </g>
        </svg>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center mb-8"><LogoFull height={52} /></div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SetupMissing() {
  return (
    <AuthFrame>
      <h2 className="text-2xl font-bold">Kurulum eksik</h2>
      <p className="text-sm text-ink-3 mt-2">
        <code className="tc-num">VITE_SUPABASE_URL</code> ve <code className="tc-num">VITE_SUPABASE_ANON_KEY</code> ortam değişkenleri tanımlı değil.
        <code className="tc-num"> .env.example</code> dosyasını <code className="tc-num">.env.local</code> olarak kopyalayın.
      </p>
    </AuthFrame>
  );
}

const ROLE_ICON: Record<string, ReactNode> = {
  yonetici: <Crown className="w-5 h-5" />, asci_basi: <ChefHat className="w-5 h-5" />, diyetisyen: <Salad className="w-5 h-5" />,
  muhasebe: <Calculator className="w-5 h-5" />, satinalma: <ShoppingCart className="w-5 h-5" />, pazarlamaci: <Megaphone className="w-5 h-5" />,
  sofor: <Truck className="w-5 h-5" />, depo: <Warehouse className="w-5 h-5" />,
};

/** Demo girişi: şifre yok; rol seçilerek o kişinin ekranı açılır. */
function DemoLogin() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enter = async (role: string) => {
    setBusy(role); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: demoEmail(role), password: 'demo-giris' });
    if (err) { setError(err.message); setBusy(null); }
  };
  return (
    <AuthFrame>
      <div className="inline-flex items-center gap-1.5 rounded-full tc-holo px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
        <Sparkles className="w-3.5 h-3.5" /> Canlı demo
      </div>
      <h2 className="text-2xl font-bold text-ink mt-3">Kimin gözünden bakalım?</h2>
      <p className="text-sm text-ink-3 mt-1.5">Bir rol seçin; o kişinin ekranı açılır. Şifre gerekmez, tüm veriler örnektir.</p>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DEMO_USERS.map((u) => (
          <button key={u.role} type="button" onClick={() => enter(u.role)} disabled={busy !== null}
            className={`group text-left rounded-2xl p-3 ring-1 ring-line bg-card hover:ring-brand/60 hover:-translate-y-0.5 transition-all disabled:opacity-60 ${u.role === 'yonetici' ? 'sm:col-span-2 tc-holo-border' : ''}`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-9 h-9 shrink-0 rounded-xl grid place-items-center ${u.role === 'yonetici' ? 'bg-brand text-on-brand' : 'bg-brand-soft text-brand'}`}>{ROLE_ICON[u.role]}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink truncate">{ROLE_LABELS[u.role as AppRole]}</span>
                <span className="block text-[11.5px] text-ink-3 truncate">{busy === u.role ? 'Açılıyor…' : u.full_name}</span>
              </span>
            </div>
            <div className="mt-2 text-[11.5px] leading-snug text-ink-2">{u.blurb}</div>
          </button>
        ))}
      </div>
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
    </AuthFrame>
  );
}

export function LoginScreen() {
  if (DEMO) return <DemoLogin />;
  return <RealLogin />;
}

function RealLogin() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [bootstrap, setBootstrap] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.rpc('needs_bootstrap').then(({ data }) => {
      if (data) { setBootstrap(true); setMode('signup'); }
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName.trim() } },
        });
        if (err) throw err;
        if (!data.session) setInfo('Hesap oluşturuldu. E-postanıza gelen bağlantıyla hesabınızı onaylayıp giriş yapın.');
      }
    } catch (err) {
      const msg = (err as { message?: string }).message ?? '';
      setError(/Invalid login/i.test(msg) ? 'E-posta veya şifre hatalı.'
        : /already registered/i.test(msg) ? 'Bu e-posta zaten kayıtlı; giriş yapın.'
        : /Password should be/i.test(msg) ? 'Şifre en az 6 karakter olmalı.'
        : msg || 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h2 className="text-2xl font-bold text-ink">{mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}</h2>
      <p className="text-sm text-ink-3 mt-1.5">
        {bootstrap
          ? 'İlk kurulum: oluşturacağınız hesap sistem yöneticisi olacak.'
          : mode === 'login' ? 'Ekip hesabınızla devam edin.' : 'Hesabınız, yönetici rol atayana kadar beklemede kalır.'}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'signup' && (
          <Field label="Ad Soyad">
            <input className="tc-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
          </Field>
        )}
        <Field label="E-posta">
          <input className="tc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Şifre">
          <input className="tc-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        {info && <div className="rounded-xl bg-ok-soft text-ok px-3 py-2.5 text-sm">{info}</div>}
        <Button type="submit" variant="primary" className="w-full" loading={busy} icon={<KeyRound className="w-4 h-4" />}>
          {mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
        </Button>
      </form>
      {!bootstrap && (
        <button type="button" className="mt-5 text-sm text-ink-3 hover:text-brand"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }}>
          {mode === 'login' ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
        </button>
      )}
    </AuthFrame>
  );
}

export function PendingAccess({ email }: { email: string }) {
  return (
    <AuthFrame>
      <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-strong grid place-items-center mb-4"><Clock3 className="w-6 h-6" /></div>
      <h2 className="text-2xl font-bold text-ink">Erişim bekleniyor</h2>
      <p className="text-sm text-ink-3 mt-2">
        <b className="text-ink-2">{email}</b> hesabı oluşturuldu. Bir yönetici <i>Ekip & Yetkiler</i> ekranından size rol atadığında
        panel açılacak. Rol atandıktan sonra sayfayı yenileyin.
      </p>
      <div className="flex gap-2 mt-6">
        <Button variant="primary" onClick={() => window.location.reload()}>Yenile</Button>
        <Button onClick={() => void signOut()} icon={<LogOut className="w-4 h-4" />}>Çıkış</Button>
      </div>
    </AuthFrame>
  );
}

export function PortalComingSoon() {
  return (
    <AuthFrame>
      <h2 className="text-2xl font-bold text-ink">Müşteri portalı</h2>
      <p className="text-sm text-ink-3 mt-2">
        Günlük yemek sayısı girişi (D-1, saat 16:00'ya kadar), teslim irsaliyeleri ve faturalarınız bu ekranda olacak.
        Portal, sipariş modülüyle birlikte açılıyor.
      </p>
      <Button className="mt-6" onClick={() => void signOut()} icon={<LogOut className="w-4 h-4" />}>Çıkış</Button>
    </AuthFrame>
  );
}
