import type { LucideIcon } from 'lucide-react';
import {
  BookOpenText, Boxes, Building2, ChefHat, ClipboardList, FileSignature, LayoutDashboard, LineChart, Megaphone, Navigation, Route,
  ShieldCheck, ShoppingCart, UsersRound, UtensilsCrossed, Wallet,
} from 'lucide-react';
import type { AppRole } from '@/lib/domain';

/** Modül içindeki sekme. Yol: `${modül}/${id}` (ilk sekme modülün kendi yoludur). Yetki anahtarı: `${modül}#${id}`. */
export interface TabDef {
  id: string;
  label: string;
  /** Varsayılan olarak görebilen roller (yoksa modülün rolleri) */
  roles?: AppRole[];
}

export interface ModuleDef {
  path: string;
  label: string;
  /** Menüde adın altında kısa açıklama (ne işe yarar) */
  hint: string;
  icon: LucideIcon;
  group: 'genel' | 'mutfak' | 'depo' | 'satis' | 'sevkiyat' | 'personel' | 'finans' | 'sistem';
  /** Varsayılan olarak görebilen roller (boşsa tüm personel). Kurucu panelinden değiştirilebilir. */
  roles?: AppRole[];
  tabs?: TabDef[];
}

export const GROUP_LABELS: Record<ModuleDef['group'], string> = {
  genel: 'Genel', mutfak: 'Mutfak', depo: 'Depo & Satınalma', satis: 'Satış & Müşteri', sevkiyat: 'Sevkiyat',
  personel: 'Personel', finans: 'Finans', sistem: 'Sistem',
};

const MGMT: AppRole[] = ['yonetici'];
const FIN: AppRole[] = ['yonetici', 'muhasebe'];

/** Sade navigasyon (ANA-PROMPT §4.1): bir iş akışı = bir modül, ayrıntılar sekme. */
export const MODULES: ModuleDef[] = [
  { path: '/', label: 'Bugün', hint: 'Rolünüze göre iş masanız', icon: LayoutDashboard, group: 'genel' },

  { path: '/uretim', label: 'Üretim', hint: 'Günlük üretim, porsiyon maliyeti', icon: ChefHat, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'depo'],
    tabs: [
      { id: 'gunluk', label: 'Günlük üretim' },
      { id: 'emir', label: 'Üretim emri', roles: ['yonetici', 'asci_basi', 'diyetisyen'] },
      { id: 'kalibrasyon', label: 'Gramaj kalibrasyonu', roles: ['yonetici', 'asci_basi', 'diyetisyen'] },
      { id: 'mutfak', label: 'Mutfak ekranı' },
    ] },
  { path: '/menuler', label: 'Menüler', hint: 'Menü kartları ve menü planı', icon: UtensilsCrossed, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'pazarlamaci', 'muhasebe', 'satinalma'],
    tabs: [
      { id: 'kartlar', label: 'Menü kartları', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'pazarlamaci', 'muhasebe'] },
      { id: 'plan', label: 'Menü planı', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'satinalma', 'pazarlamaci'] },
    ] },
  { path: '/receteler', label: 'Reçeteler', hint: '1 kişilik gramaj ve maliyet', icon: BookOpenText, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'satinalma', 'muhasebe'] },

  { path: '/stok', label: 'Stok', hint: 'Eldeki miktar, sayım, stok kartları', icon: Boxes, group: 'depo', roles: ['yonetici', 'depo', 'satinalma', 'asci_basi', 'diyetisyen', 'sofor', 'muhasebe'],
    tabs: [
      { id: 'durum', label: 'Stok durumu', roles: ['yonetici', 'depo', 'satinalma', 'asci_basi'] },
      { id: 'sevk', label: 'Firmalara giden', roles: ['yonetici', 'depo', 'sofor', 'muhasebe'] },
      { id: 'kartlar', label: 'Stok kartları', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'satinalma', 'depo', 'muhasebe'] },
    ] },
  { path: '/satinalma', label: 'Satınalma', hint: 'Menüye göre ihtiyaç, teklif, sipariş', icon: ShoppingCart, group: 'depo', roles: ['yonetici', 'satinalma', 'depo'] },

  { path: '/siparisler', label: 'Siparişler', hint: 'Günlük yemek sayıları', icon: ClipboardList, group: 'satis', roles: ['yonetici', 'muhasebe', 'asci_basi', 'pazarlamaci', 'diyetisyen'] },
  { path: '/cari', label: 'Cari Hesaplar', hint: 'Müşteriler ve tedarikçiler', icon: Building2, group: 'satis', roles: ['yonetici', 'muhasebe', 'pazarlamaci', 'satinalma'],
    tabs: [
      { id: 'musteriler', label: 'Müşteriler', roles: ['yonetici', 'muhasebe', 'pazarlamaci'] },
      { id: 'tedarikciler', label: 'Tedarikçiler', roles: ['yonetici', 'satinalma', 'muhasebe'] },
    ] },
  { path: '/teklifler', label: 'Teklifler & Sunum', hint: 'Kişi başı fiyat, teklif, menü sunumu', icon: FileSignature, group: 'satis', roles: ['yonetici', 'pazarlamaci', 'muhasebe'] },
  { path: '/sosyal-medya', label: 'Sosyal Medya', hint: 'Hesaplar, takvim, içerik onayı', icon: Megaphone, group: 'satis', roles: ['yonetici', 'pazarlamaci'] },

  { path: '/lojistik', label: 'Lojistik', hint: 'Rota, harita, araçlar, canlı takip', icon: Route, group: 'sevkiyat', roles: ['yonetici', 'sofor', 'muhasebe'] },
  { path: '/sofor', label: 'Şoför Ekranı', hint: 'Bugünkü duraklar, yol tarifi', icon: Navigation, group: 'sevkiyat', roles: ['sofor'] },

  { path: '/personel', label: 'Personel', hint: 'Kartlar, puantaj, bakiye', icon: UsersRound, group: 'personel', roles: FIN,
    tabs: [{ id: 'kartlar', label: 'Kartlar & talepler' }, { id: 'puantaj', label: 'Puantaj & maaş' }, { id: 'bakiye', label: 'Bakiye & ödemeler' }] },

  { path: '/finans', label: 'Finans', hint: 'Özet, giderler, gelen faturalar', icon: LineChart, group: 'finans', roles: ['yonetici', 'muhasebe', 'satinalma'],
    tabs: [
      { id: 'ozet', label: 'Özet', roles: FIN },
      { id: 'giderler', label: 'Giderler', roles: FIN },
      { id: 'faturalar', label: 'Gelen faturalar', roles: ['yonetici', 'muhasebe', 'satinalma'] },
    ] },
  { path: '/kasa', label: 'Kasa & Banka', hint: 'Bakiye, tahsilat, ödeme', icon: Wallet, group: 'finans', roles: FIN },

  { path: '/ayarlar', label: 'Ayarlar', hint: 'Kullanıcılar, firma, yetkiler', icon: ShieldCheck, group: 'sistem', roles: MGMT,
    tabs: [{ id: 'ekip', label: 'Kullanıcılar & firma', roles: MGMT }, { id: 'yetkiler', label: 'Yetkiler (kurucu)', roles: [] }] },
];

/** Eski adresler (yer imleri bozulmasın) → yeni modül/sekme */
export const ALIASES: Record<string, string> = {
  '/kahvalti': '/uretim/gunluk/kahvalti',
  '/mutfak-ekrani': '/uretim/mutfak',
  '/menu-plani': '/menuler/plan',
  '/hammaddeler': '/stok/kartlar',
  '/stok/hammaddeler': '/stok/kartlar',
  '/sevk': '/stok/sevk',
  '/musteriler': '/cari/musteriler',
  '/tedarikciler': '/cari/tedarikciler',
  '/irsaliye': '/cari',
  '/pazarlama': '/teklifler',
  '/rota': '/lojistik',
  '/filo': '/lojistik',
  '/puantaj': '/personel/puantaj',
  '/personel-bakiye': '/personel/bakiye',
  '/giderler': '/finans/giderler',
  '/gelen-faturalar': '/finans/faturalar',
  '/cek-senet': '/kasa',
  '/ekip': '/ayarlar/ekip',
  '/kurucu': '/ayarlar/yetkiler',
};

/** Eski yolu yeni yola çevirir (alt yollar korunur); eski değilse null */
export function resolveAlias(path: string): string | null {
  for (const [from, to] of Object.entries(ALIASES)) {
    if (path === from) return to;
    if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
  }
  return null;
}

/** Yetki anahtarı: modül için yol, sekme için `yol#sekme` */
export const permKey = (m: ModuleDef, tab?: TabDef) => (tab ? `${m.path}#${tab.id}` : m.path);

// Teslim listesi (sürüm notu): kalan işler burada değil, docs/PLAN.md'de
export const ROADMAP: Array<{ label: string; detail: string }> = [
  { label: 'e-Fatura entegratörü', detail: 'Satış faturası UBL-TR XML hazır; entegratör API bilgileri girilince otomatik gönderim' },
  { label: 'Araç takip (Arvento / Mobiliz)', detail: 'API anahtarı girilince km ve yakıt otomatik gelir; şimdilik fiş ve km elle' },
  { label: 'Sosyal medya otomatik paylaşım', detail: 'Meta / Google hesabı bağlanınca planlı gönderiler kendiliğinden yayınlanır' },
];

/** Kurucu panelindeki görünürlük ayarı: rol × modül/sekme ('yok' = gizli) ve kişiye özel istisna */
export interface PermissionMaps {
  role: Map<string, string>;     // `${role}|${anahtar}` → level
  member: Map<string, string>;   // anahtar → level (giriş yapan kişi için)
}

/** Ekranı yazılmakta olan modüller (menüde gösterilmez; bitince listeden çıkar) */
export const IN_PROGRESS = new Set<string>(['/teklifler', '/sosyal-medya', '/lojistik', '/sofor']);

export function defaultVisible(m: ModuleDef, role: AppRole, tab?: TabDef): boolean {
  const roles = tab?.roles ?? m.roles;
  return !roles || roles.includes(role);
}

/** Tek bir modülün veya sekmenin görünürlüğü: kişiye özel > rol ayarı > varsayılan. Sekme ayarı yoksa modül ayarı geçerlidir. */
function levelVisible(m: ModuleDef, role: AppRole, perms: PermissionMaps | undefined, tab?: TabDef): boolean {
  const keys = tab ? [permKey(m, tab), m.path] : [m.path];
  for (const k of keys) { const v = perms?.member.get(k); if (v) return v !== 'yok'; }
  for (const k of keys) { const v = perms?.role.get(`${role}|${k}`); if (v) return v !== 'yok'; }
  return defaultVisible(m, role, tab);
}

export function visibleTabs(m: ModuleDef, role: AppRole, perms?: PermissionMaps): TabDef[] {
  if (!m.tabs) return [];
  if (role === 'kurucu') return m.tabs;
  return m.tabs.filter((t) => levelVisible(m, role, perms, t));
}

export function visibleModules(role: AppRole, perms?: PermissionMaps): ModuleDef[] {
  if (role === 'musteri') return [];
  const ready = MODULES.filter((m) => !IN_PROGRESS.has(m.path));
  if (role === 'kurucu') return ready;
  return ready.filter((m) => {
    if (m.path === '/') return true; // Bugün: herkesin iş masası
    if (m.tabs) return visibleTabs(m, role, perms).length > 0;
    return levelVisible(m, role, perms);
  });
}

export function activeModule(path: string): ModuleDef | undefined {
  if (path === '/') return MODULES[0];
  return MODULES.filter((m) => m.path !== '/').find((m) => path === m.path || path.startsWith(`${m.path}/`));
}

/** Yolu modül + sekme + kalan parçalara ayırır. Sekme yazılmamışsa ya da görünmüyorsa ilk görünen sekme seçilir. */
export function resolveRoute(path: string, role: AppRole, perms?: PermissionMaps): { mod?: ModuleDef; tab?: TabDef; rest: string[]; tabs: TabDef[] } {
  const mod = activeModule(path);
  if (!mod) return { rest: [], tabs: [] };
  const parts = path.slice(mod.path.length).split('/').filter(Boolean);
  const tabs = visibleTabs(mod, role, perms);
  if (!mod.tabs) return { mod, rest: parts, tabs };
  const named = tabs.find((t) => t.id === parts[0]);
  return { mod, tab: named ?? tabs[0], rest: named ? parts.slice(1) : parts, tabs };
}

export const tabPath = (m: ModuleDef, t: TabDef) => (m.tabs?.[0]?.id === t.id ? m.path : `${m.path}/${t.id}`);
