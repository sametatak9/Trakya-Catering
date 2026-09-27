import type { AppRole } from '@/lib/domain';
import { activeModule, resolveRoute, visibleModules, type PermissionMaps } from './modules';

/**
 * Rol çalışma alanı (ANA-PROMPT §4.2): "Bugün" ekranı rolüne göre kart gösterir.
 * Kart = başlık + ana modülün verisinden bir sayı/liste + tıklayınca gidilen modül/sekme.
 * Yeni modül açılmaz; kartlar yalnız o rolün görebildiği yerlere götürür.
 */
export type CardId =
  | 'yarin_uretim' | 'bugun_recetesiz' | 'bugun_fiyatsiz_malzeme' | 'menu_plani_bos'
  | 'kritik_stok' | 'bugun_stok_cikis' | 'bugun_sevk'
  | 'acik_satinalma' | 'eski_fiyat'
  | 'vadesi_gelen' | 'taslak_fatura' | 'bekleyen_talep' | 'fiyatsiz_siparis'
  | 'siparis_girmeyen' | 'aktif_musteri' | 'bugun_teslim' | 'taleplerim';

export interface CardDef {
  id: CardId;
  title: string;
  /** Tıklayınca gidilecek yol (modül veya modül/sekme); null = yalnız bilgi */
  to: string | null;
}

export const CARDS: Record<CardId, CardDef> = {
  yarin_uretim: { id: 'yarin_uretim', title: 'Yarının üretimi', to: '/uretim' },
  bugun_recetesiz: { id: 'bugun_recetesiz', title: 'Reçetesi olmayan yemekler', to: '/uretim' },
  bugun_fiyatsiz_malzeme: { id: 'bugun_fiyatsiz_malzeme', title: 'Malzemesi eksik yemekler', to: '/uretim' },
  menu_plani_bos: { id: 'menu_plani_bos', title: 'Menü planı boş günler', to: '/menuler/plan' },
  kritik_stok: { id: 'kritik_stok', title: 'Kritik stok', to: '/stok' },
  bugun_stok_cikis: { id: 'bugun_stok_cikis', title: 'Bugünkü stok hareketleri', to: '/stok' },
  bugun_sevk: { id: 'bugun_sevk', title: 'Bugün firmalara giden', to: '/stok/sevk' },
  acik_satinalma: { id: 'acik_satinalma', title: 'Açık satınalma siparişleri', to: '/satinalma' },
  eski_fiyat: { id: 'eski_fiyat', title: 'Fiyatı eskiyen stok kartları', to: '/stok/kartlar' },
  vadesi_gelen: { id: 'vadesi_gelen', title: '7 gün içinde vadesi gelenler', to: '/kasa' },
  taslak_fatura: { id: 'taslak_fatura', title: 'Onay bekleyen faturalar', to: '/finans/faturalar' },
  bekleyen_talep: { id: 'bekleyen_talep', title: 'Bekleyen personel talepleri', to: '/personel' },
  fiyatsiz_siparis: { id: 'fiyatsiz_siparis', title: 'Fiyatı girilmemiş siparişler', to: '/siparisler' },
  siparis_girmeyen: { id: 'siparis_girmeyen', title: 'Yarın için sayı vermeyen firmalar', to: '/siparisler' },
  aktif_musteri: { id: 'aktif_musteri', title: 'Aktif müşteriler', to: '/cari/musteriler' },
  bugun_teslim: { id: 'bugun_teslim', title: 'Bugünkü teslimler', to: null },
  taleplerim: { id: 'taleplerim', title: 'Taleplerim (avans, izin…)', to: null },
};

/** Rol → kart sırası. Yönetici ve kurucu "Özet · Onaylar" görür (kart seti yok). */
export const ROLE_CARDS: Partial<Record<AppRole, CardId[]>> = {
  asci_basi: ['yarin_uretim', 'bugun_recetesiz', 'bugun_fiyatsiz_malzeme', 'kritik_stok', 'menu_plani_bos', 'taleplerim'],
  diyetisyen: ['yarin_uretim', 'menu_plani_bos', 'bugun_recetesiz', 'bugun_fiyatsiz_malzeme', 'taleplerim'],
  depo: ['kritik_stok', 'bugun_stok_cikis', 'bugun_sevk', 'yarin_uretim', 'taleplerim'],
  satinalma: ['acik_satinalma', 'kritik_stok', 'eski_fiyat', 'taslak_fatura', 'taleplerim'],
  muhasebe: ['vadesi_gelen', 'taslak_fatura', 'fiyatsiz_siparis', 'bekleyen_talep', 'taleplerim'],
  pazarlamaci: ['siparis_girmeyen', 'fiyatsiz_siparis', 'aktif_musteri', 'taleplerim'],
  sofor: ['bugun_teslim', 'bugun_sevk', 'taleplerim'],
};

export const hasManagerHome = (role: AppRole) => role === 'yonetici' || role === 'kurucu';

/** Rolün kartları; hedefi o rolde görünmeyen kart gösterilmez (tıklayınca "sayfa yok" çıkmasın). */
export function workspaceCards(role: AppRole, perms?: PermissionMaps): CardDef[] {
  const ids = ROLE_CARDS[role] ?? [];
  const visible = new Set(visibleModules(role, perms).map((m) => m.path));
  return ids.map((id) => CARDS[id]).filter((c) => {
    if (!c.to) return true;
    const mod = activeModule(c.to);
    if (!mod || !visible.has(mod.path)) return false;
    const r = resolveRoute(c.to, role, perms);
    // Sekmeli hedefte istenen sekme o rolde açık olmalı
    const wanted = c.to.slice(mod.path.length).split('/').filter(Boolean)[0];
    return !mod.tabs || (r.tab !== undefined && (!wanted || r.tab.id === wanted));
  });
}
