import type { LucideIcon } from 'lucide-react';
import {
  Banknote, BookOpenText, Boxes, Building2, CalendarCheck2, CalendarRange, Car, ChefHat, ClipboardList, Coffee, CookingPot, Crown,
  FileInput, FileSignature, FileText, Handshake, LayoutDashboard, LineChart, Megaphone, Navigation, PackageOpen, Route, ScrollText,
  ShieldCheck, ShoppingCart, TrendingDown, UsersRound, UtensilsCrossed, Wallet, WalletCards, Wheat,
} from 'lucide-react';
import type { AppRole } from '@/lib/domain';

export interface ModuleDef {
  path: string;
  label: string;
  /** Menüde adın altında kısa açıklama (ne işe yarar) */
  hint: string;
  icon: LucideIcon;
  group: 'genel' | 'mutfak' | 'depo' | 'satis' | 'sevkiyat' | 'personel' | 'finans' | 'sistem';
  /** Varsayılan olarak görebilen roller (boşsa tüm personel). Kurucu panelinden değiştirilebilir. */
  roles?: AppRole[];
}

export const GROUP_LABELS: Record<ModuleDef['group'], string> = {
  genel: 'Genel', mutfak: 'Mutfak', depo: 'Depo & Satınalma', satis: 'Satış & Müşteri', sevkiyat: 'Sevkiyat & Filo',
  personel: 'Personel', finans: 'Finans', sistem: 'Sistem',
};

const MGMT: AppRole[] = ['yonetici'];
const FIN: AppRole[] = ['yonetici', 'muhasebe'];

export const MODULES: ModuleDef[] = [
  { path: '/', label: 'Bugün', hint: 'Günün özeti', icon: LayoutDashboard, group: 'genel' },

  { path: '/uretim', label: 'Günlük Hazırlık & Maliyet', hint: 'Ne hazırlandı, porsiyon kaça mal oldu', icon: ChefHat, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'depo'] },
  { path: '/mutfak-ekrani', label: 'Mutfak Ekranı', hint: 'Büyük yazı, adım adım (tablet)', icon: CookingPot, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'depo'] },
  { path: '/kahvalti', label: 'Kahvaltı', hint: 'Kahvaltı hazırlığı ve maliyeti', icon: Coffee, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen'] },
  { path: '/menu-plani', label: 'Menü Planı', hint: 'Haftalık, firmaya özel menüler', icon: CalendarRange, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'satinalma', 'pazarlamaci'] },
  { path: '/receteler', label: 'Reçeteler & Gramaj', hint: '1 porsiyon ve maliyeti', icon: BookOpenText, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'satinalma', 'muhasebe'] },
  { path: '/menuler', label: 'Menüler', hint: 'Kaç çeşitse, kişi başı maliyet', icon: UtensilsCrossed, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'pazarlamaci', 'muhasebe'] },
  { path: '/hammaddeler', label: 'Hammaddeler', hint: 'Fiyat, fire, alerjen', icon: Wheat, group: 'mutfak', roles: ['yonetici', 'asci_basi', 'diyetisyen', 'satinalma', 'depo', 'muhasebe'] },

  { path: '/stok', label: 'Stok & Depo', hint: 'Eldeki miktar, giriş-çıkış, sayım', icon: Boxes, group: 'depo', roles: ['yonetici', 'depo', 'satinalma', 'asci_basi'] },
  { path: '/sevk', label: 'Firmalara Giden Malzeme', hint: 'Tuz, ketçap, yağ… maliyete girer', icon: PackageOpen, group: 'depo', roles: ['yonetici', 'depo', 'sofor', 'muhasebe'] },
  { path: '/satinalma', label: 'Satınalma', hint: 'Menüye göre aylık ihtiyaç, en uygun fiyat', icon: ShoppingCart, group: 'depo', roles: ['yonetici', 'satinalma', 'depo'] },
  { path: '/tedarikciler', label: 'Tedarikçiler', hint: 'Fiyat kayıtları, cari borç', icon: Handshake, group: 'depo', roles: ['yonetici', 'satinalma', 'muhasebe'] },

  { path: '/siparisler', label: 'Siparişler', hint: 'Günlük yemek sayıları', icon: ClipboardList, group: 'satis', roles: ['yonetici', 'muhasebe', 'asci_basi', 'pazarlamaci', 'diyetisyen'] },
  { path: '/irsaliye', label: 'İrsaliye & Satış Faturası', hint: 'Teslimden irsaliye, aydan fatura', icon: ScrollText, group: 'satis', roles: ['yonetici', 'muhasebe', 'sofor'] },
  { path: '/musteriler', label: 'Müşteriler & Cari', hint: 'Fiyat, vade, ekstre, sipariş linki', icon: Building2, group: 'satis', roles: ['yonetici', 'muhasebe', 'pazarlamaci'] },
  { path: '/teklifler', label: 'Kurumsal Teklifler', hint: 'Kişi başı fiyat hesabı, teklif formu', icon: FileSignature, group: 'satis', roles: ['yonetici', 'pazarlamaci', 'muhasebe'] },
  { path: '/pazarlama', label: 'Müşteri Bulma & Saha', hint: 'Aday firmalar, günlük ziyaret rotası', icon: Megaphone, group: 'satis', roles: ['yonetici', 'pazarlamaci'] },
  { path: '/sosyal-medya', label: 'Sosyal Medya', hint: 'İçerik havuzu, aylık takvim', icon: FileText, group: 'satis', roles: ['yonetici', 'pazarlamaci'] },

  { path: '/rota', label: 'Rota & Harita', hint: 'Firmalar haritada, şoföre rota', icon: Route, group: 'sevkiyat', roles: ['yonetici', 'sofor'] },
  { path: '/sofor', label: 'Şoför Ekranı', hint: 'Bugünkü duraklar, yol tarifi', icon: Navigation, group: 'sevkiyat', roles: ['yonetici', 'sofor'] },
  { path: '/filo', label: 'Araçlar & Filo', hint: 'Km, yakıt fişi, bakım, muayene', icon: Car, group: 'sevkiyat', roles: ['yonetici', 'sofor', 'muhasebe'] },

  { path: '/personel', label: 'Personel', hint: 'Kartlar, kartvizit, talepler', icon: UsersRound, group: 'personel', roles: ['yonetici', 'muhasebe'] },
  { path: '/puantaj', label: 'Puantaj & Maaş', hint: 'Parmak izi, 10 saat kuralı', icon: CalendarCheck2, group: 'personel', roles: FIN },
  { path: '/personel-bakiye', label: 'Personel Bakiyeleri', hint: 'Hakediş, avans, ödeme — canlı', icon: WalletCards, group: 'personel', roles: FIN },

  { path: '/finans', label: 'Finans Özeti', hint: 'Gelir-gider, net kâr', icon: LineChart, group: 'finans', roles: FIN },
  { path: '/giderler', label: 'Giderler', hint: 'Elektrik, su, kira, mazot…', icon: TrendingDown, group: 'finans', roles: FIN },
  { path: '/gelen-faturalar', label: 'Gelen Faturalar', hint: 'e-Fatura yükle, gider tespit', icon: FileInput, group: 'finans', roles: ['yonetici', 'muhasebe', 'satinalma'] },
  { path: '/kasa', label: 'Kasa & Banka', hint: 'Bakiye, tahsilat, ödeme', icon: Wallet, group: 'finans', roles: FIN },
  { path: '/cek-senet', label: 'Çek & Senet', hint: 'Portföy, vade, tahsil', icon: Banknote, group: 'finans', roles: FIN },

  { path: '/kurucu', label: 'Kurucu Paneli', hint: 'Kim hangi sekmeyi görür, entegrasyonlar', icon: Crown, group: 'sistem', roles: [] },
  { path: '/ekip', label: 'Ekip & Firma', hint: 'Kullanıcılar, roller, logo ve antet', icon: ShieldCheck, group: 'sistem', roles: MGMT },
];

// Teslim listesi (sürüm notu): kalan işler burada değil, docs/PLAN.md'de
export const ROADMAP: Array<{ label: string; detail: string }> = [
  { label: 'e-Fatura entegratörü', detail: 'Satış faturası UBL-TR XML hazır; entegratör API bilgileri girilince otomatik gönderim' },
  { label: 'Araç takip (Arvento / Mobiliz)', detail: 'API anahtarı girilince km ve yakıt otomatik gelir; şimdilik fiş ve km elle' },
  { label: 'Sosyal medya otomatik paylaşım', detail: 'Meta / Google hesabı bağlanınca planlı gönderiler kendiliğinden yayınlanır' },
];

/** Kurucu panelindeki görünürlük ayarı: rol × modül ('yok' = gizli) ve kişiye özel istisna */
export interface PermissionMaps {
  role: Map<string, string>;     // `${role}|${path}` → level
  member: Map<string, string>;   // path → level (giriş yapan kişi için)
}

/** Ekranı yazılmakta olan sekmeler (menüde gösterilmez; bitince listeden çıkar) */
export const IN_PROGRESS = new Set<string>(['/irsaliye', '/teklifler', '/pazarlama', '/sosyal-medya', '/rota', '/sofor', '/filo', '/cek-senet']);

export function defaultVisible(m: ModuleDef, role: AppRole): boolean {
  return !m.roles || m.roles.includes(role);
}

export function visibleModules(role: AppRole, perms?: PermissionMaps): ModuleDef[] {
  if (role === 'musteri') return [];
  const ready = MODULES.filter((m) => !IN_PROGRESS.has(m.path));
  if (role === 'kurucu') return ready;
  return ready.filter((m) => {
    if (m.path === '/kurucu') return false;
    const personal = perms?.member.get(m.path);
    if (personal) return personal !== 'yok';
    const byRole = perms?.role.get(`${role}|${m.path}`);
    if (byRole) return byRole !== 'yok';
    return defaultVisible(m, role);
  });
}

export function activeModule(path: string): ModuleDef | undefined {
  if (path === '/') return MODULES[0];
  return MODULES.filter((m) => m.path !== '/').find((m) => path === m.path || path.startsWith(`${m.path}/`));
}
