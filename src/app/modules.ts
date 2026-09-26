import type { LucideIcon } from 'lucide-react';
import {
  BookOpenText, CalendarRange, ChefHat, ClipboardList, Factory, LayoutDashboard, MonitorPlay, Package, PiggyBank,
  ReceiptText, ShieldCheck, ShoppingBasket, Truck, UsersRound, UtensilsCrossed, Wheat,
} from 'lucide-react';
import type { AppRole } from '@/lib/domain';

export interface ModuleDef {
  path: string;
  label: string;
  icon: LucideIcon;
  group: 'genel' | 'mutfak' | 'operasyon' | 'finans' | 'sistem';
  /** Boşsa tüm personel görür */
  roles?: AppRole[];
  /** 'soon' modüller menüde görünür ama henüz açılmaz (sahte ekran yok) */
  status: 'ready' | 'soon';
  phase?: number;
}

export const GROUP_LABELS: Record<ModuleDef['group'], string> = {
  genel: 'Genel',
  mutfak: 'Mutfak',
  operasyon: 'Operasyon',
  finans: 'Finans & İK',
  sistem: 'Sistem',
};

export const MODULES: ModuleDef[] = [
  { path: '/', label: 'Komuta Merkezi', icon: LayoutDashboard, group: 'genel', status: 'ready' },

  { path: '/receteler', label: 'Reçeteler & Gramaj', icon: BookOpenText, group: 'mutfak', status: 'ready' },
  { path: '/hammaddeler', label: 'Hammaddeler', icon: Wheat, group: 'mutfak', status: 'ready' },
  { path: '/menuler', label: 'Menüler', icon: UtensilsCrossed, group: 'mutfak', status: 'ready' },
  { path: '/menu-plani', label: 'Menü Planı', icon: CalendarRange, group: 'mutfak', status: 'soon', phase: 3 },
  { path: '/uretim', label: 'Üretim & MRP', icon: Factory, group: 'mutfak', status: 'soon', phase: 3 },
  { path: '/mutfak-ekrani', label: 'Mutfak Ekranı', icon: MonitorPlay, group: 'mutfak', status: 'soon', phase: 6 },

  { path: '/siparisler', label: 'Siparişler (D-1)', icon: ClipboardList, group: 'operasyon', status: 'soon', phase: 3 },
  { path: '/depo', label: 'Depo & Stok', icon: Package, group: 'operasyon', status: 'soon', phase: 3 },
  { path: '/satinalma', label: 'Satınalma', icon: ShoppingBasket, group: 'operasyon', status: 'soon', phase: 3 },
  { path: '/sevkiyat', label: 'Sevkiyat & Araçlar', icon: Truck, group: 'operasyon', status: 'soon', phase: 4 },

  { path: '/cari', label: 'Cari & E-Fatura', icon: ReceiptText, group: 'finans', status: 'soon', phase: 4 },
  { path: '/maliyet', label: 'Maliyet & Net Kâr', icon: PiggyBank, group: 'finans', status: 'soon', phase: 5 },
  { path: '/personel', label: 'Personel & Puantaj', icon: ChefHat, group: 'finans', status: 'soon', phase: 5 },

  { path: '/ekip', label: 'Ekip & Yetkiler', icon: ShieldCheck, group: 'sistem', roles: ['yonetici'], status: 'ready' },
];

export const PORTAL_ICON = UsersRound;

export function visibleModules(role: AppRole): ModuleDef[] {
  if (role === 'musteri') return [];
  return MODULES.filter((m) => !m.roles || m.roles.includes(role));
}

export function activeModule(path: string): ModuleDef | undefined {
  if (path === '/') return MODULES[0];
  return MODULES.filter((m) => m.path !== '/').find((m) => path === m.path || path.startsWith(`${m.path}/`));
}
