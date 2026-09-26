import type { LucideIcon } from 'lucide-react';
import {
  BookOpenText, CalendarRange, ChefHat, ClipboardList, Building2, Coffee, FileInput, LayoutDashboard, LineChart, ShieldCheck,
  TrendingDown, UtensilsCrossed, Wallet, Wheat,
} from 'lucide-react';
import { ROLES, type AppRole } from '@/lib/domain';

export interface ModuleDef {
  path: string;
  label: string;
  /** Menüde adın altında kısa açıklama (ne işe yarar) */
  hint: string;
  icon: LucideIcon;
  group: 'genel' | 'mutfak' | 'satis' | 'finans' | 'sistem';
  /** Boşsa tüm personel görür */
  roles?: AppRole[];
}

export const GROUP_LABELS: Record<ModuleDef['group'], string> = {
  genel: 'Genel',
  mutfak: 'Mutfak',
  satis: 'Satış',
  finans: 'Finans',
  sistem: 'Sistem',
};

export const MODULES: ModuleDef[] = [
  { path: '/', label: 'Bugün', hint: 'Günün özeti', icon: LayoutDashboard, group: 'genel' },

  { path: '/uretim', label: 'Günlük Hazırlık & Maliyet', hint: 'Ne hazırlandı, porsiyon kaça mal oldu', icon: ChefHat, group: 'mutfak' },
  { path: '/kahvalti', label: 'Kahvaltı', hint: 'Kahvaltı hazırlığı ve maliyeti', icon: Coffee, group: 'mutfak' },
  { path: '/menu-plani', label: 'Menü Planı', hint: 'Haftalık, firmaya özel menüler', icon: CalendarRange, group: 'mutfak' },
  { path: '/receteler', label: 'Reçeteler & Gramaj', hint: '1 porsiyon ve maliyeti', icon: BookOpenText, group: 'mutfak' },
  { path: '/menuler', label: 'Menüler', hint: 'Kaç çeşitse, kişi başı maliyet', icon: UtensilsCrossed, group: 'mutfak' },
  { path: '/hammaddeler', label: 'Hammaddeler', hint: 'Fiyat, fire, alerjen', icon: Wheat, group: 'mutfak' },

  { path: '/siparisler', label: 'Siparişler', hint: 'Günlük yemek sayıları', icon: ClipboardList, group: 'satis' },
  { path: '/musteriler', label: 'Müşteriler', hint: 'Firmalar, fiyat, vade', icon: Building2, group: 'satis' },

  { path: '/finans', label: 'Finans Özeti', hint: 'Gelir-gider, net kâr', icon: LineChart, group: 'finans', roles: ROLES.finance },
  { path: '/giderler', label: 'Giderler', hint: 'Elektrik, su, kira, mazot…', icon: TrendingDown, group: 'finans', roles: ROLES.finance },
  { path: '/gelen-faturalar', label: 'Gelen Faturalar', hint: 'e-Fatura yükle, gider tespit', icon: FileInput, group: 'finans', roles: ROLES.invoices },
  { path: '/kasa', label: 'Kasa & Gelirler', hint: 'Bakiye, tahsilat, ödeme', icon: Wallet, group: 'finans', roles: ROLES.finance },

  { path: '/ekip', label: 'Ekip & Yetkiler', hint: 'Kullanıcılar ve roller', icon: ShieldCheck, group: 'sistem', roles: ['yonetici'] },
];

/** Planlanan modüller (yalnızca yol haritasında gösterilir; menüyü kalabalıklaştırmaz) */
export const ROADMAP: Array<{ label: string; detail: string }> = [
  { label: 'Depo & stok', detail: 'Hazırlıktan otomatik çıkış, sayım, SKT, eksik hammadde listesi' },
  { label: 'Firmalara giden malzemeler', detail: 'Tuz, ketçap, mayonez, yağ… stoktan düşer, maliyete girer' },
  { label: 'Satınalma & tedarikçi ağı', detail: 'Fiyat geçmişi karşılaştırma, en uygun tedarikçi önerisi' },
  { label: 'Filo, rota & şoför', detail: 'Harita üzerinde rota, şoför ekranı, mazot/bakım/km, Arvento-Mobiliz bağlantısı, sohbet' },
  { label: 'Kurucu paneli', detail: 'Her üyeliğin neyi görüp yazacağını kurucu belirler' },
  { label: 'Personel, puantaj & bakiye', detail: 'Parmak izi (ZKTeco) yoklaması, 10 saat kuralı, yevmiye/avans canlı bakiye, kartvizit' },
  { label: 'Satış e-faturası', detail: 'Ay sonu irsaliyelerden toplu fatura, entegratör ile gönderim' },
  { label: 'Teklifler', detail: 'Kurumsal teklif şablonu, kişi başı fiyat hesaplayıcı' },
  { label: 'Müşteri bulma & saha', detail: 'Bölgesel firma botu, pazarlamacı günlük rota, ziyaret fotoğrafı' },
  { label: 'Sosyal medya', detail: 'Embay yöntemi: içerik havuzu, aylık takvim, onay kuyruğu' },
  { label: 'Müşteri portalı', detail: 'Firmalar ertesi günün sayısını 16:00’ya kadar kendisi girer' },
];

export function visibleModules(role: AppRole): ModuleDef[] {
  if (role === 'musteri') return [];
  return MODULES.filter((m) => !m.roles || m.roles.includes(role));
}

export function activeModule(path: string): ModuleDef | undefined {
  if (path === '/') return MODULES[0];
  return MODULES.filter((m) => m.path !== '/').find((m) => path === m.path || path.startsWith(`${m.path}/`));
}
