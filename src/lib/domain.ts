// Alan sözlükleri — veritabanındaki CHECK kısıtlarıyla aynı kodlar.

export type AppRole = 'kurucu' | 'yonetici' | 'asci_basi' | 'diyetisyen' | 'depo' | 'satinalma' | 'muhasebe' | 'pazarlamaci' | 'sofor' | 'musteri';

export const ROLE_LABELS: Record<AppRole, string> = {
  kurucu: 'Kurucu',
  yonetici: 'Yönetici',
  asci_basi: 'Aşçıbaşı',
  diyetisyen: 'Diyetisyen',
  depo: 'Depo',
  satinalma: 'Satınalma',
  muhasebe: 'Muhasebe',
  pazarlamaci: 'Pazarlama',
  sofor: 'Şoför',
  musteri: 'Müşteri (portal)',
};

export const INGREDIENT_CATEGORIES: Record<string, string> = {
  et_tavuk: 'Et / Tavuk',
  balik: 'Balık',
  sebze_meyve: 'Sebze / Meyve',
  bakliyat_tahil: 'Bakliyat / Tahıl',
  sut_urunleri: 'Süt Ürünleri',
  yag: 'Yağlar',
  baharat_sos: 'Baharat / Sos',
  kuru_gida: 'Kuru Gıda',
  icecek: 'İçecek',
  ekmek_unlu: 'Ekmek / Unlu',
  temizlik_sarf: 'Temizlik / Sarf',
  temizlik_deterjan: 'Temizlik / Deterjan',
  ambalaj: 'Ambalaj / Tek kullanımlık',
  gaz_yakit: 'Gaz / Yakıt',
  mutfak_sarf: 'Mutfak sarfı',
  diger: 'Diğer',
};

/** TGK / AB 14 alerjen */
export const ALLERGENS: Record<string, string> = {
  gluten: 'Gluten',
  kabuklu_deniz: 'Kabuklu deniz ürünü',
  yumurta: 'Yumurta',
  balik: 'Balık',
  yer_fistigi: 'Yer fıstığı',
  soya: 'Soya',
  sut: 'Süt / Laktoz',
  sert_kabuklu: 'Sert kabuklu meyve',
  kereviz: 'Kereviz',
  hardal: 'Hardal',
  susam: 'Susam',
  sulfit: 'Sülfit',
  aci_bakla: 'Acı bakla (lupin)',
  yumusakca: 'Yumuşakça',
};

export const MENU_KINDS: Record<string, string> = {
  standart: 'Standart',
  kahvalti: 'Kahvaltı',
  soguk_mezeli: 'Soğuk mezeli',
  diyet: 'Diyet',
  ozel: 'Özel / organizasyon',
};

export const MEALS: Record<string, string> = {
  kahvalti: 'Kahvaltı',
  ogle: 'Öğle',
  aksam: 'Akşam',
  gece: 'Gece / Sahur',
};

/** Stok birimleri (stok kartında seçilebilenler) */
export const PREP_STATUS: Record<string, { label: string; tone: 'idle' | 'wait' | 'ok' }> = {
  taslak: { label: 'Hazırlanıyor', tone: 'wait' },
  pisti: { label: 'Pişti', tone: 'ok' },
  kapandi: { label: 'Kapandı', tone: 'idle' },
};

export const STOCK_UNITS: Array<{ code: string; label: string; base: 'g' | 'ml' | 'adet'; toBase: number }> = [
  { code: 'kg', label: 'kg', base: 'g', toBase: 1000 },
  { code: 'lt', label: 'lt', base: 'ml', toBase: 1000 },
  { code: 'adet', label: 'adet', base: 'adet', toBase: 1 },
  { code: 'g', label: 'g', base: 'g', toBase: 1 },
  { code: 'ml', label: 'ml', base: 'ml', toBase: 1 },
];

export function unitInfo(code: string) {
  return STOCK_UNITS.find((u) => u.code === code) ?? { code, label: code, base: 'adet' as const, toBase: 1 };
}

/** Fiyatı bu kadar günden eski hammaddeler "güncel değil" sayılır */
export const PRICE_STALE_DAYS = 14;

export const ORDER_STATUS: Record<string, { label: string; tone: 'idle' | 'info' | 'ok' | 'stop' }> = {
  bekliyor: { label: 'Bekliyor', tone: 'idle' },
  onaylandi: { label: 'Onaylandı', tone: 'info' },
  teslim_edildi: { label: 'Teslim edildi', tone: 'ok' },
  iptal: { label: 'İptal', tone: 'stop' },
};

export const ORDER_KINDS: Record<string, string> = { sozlesmeli: 'Sözleşmeli', organizasyon: 'Organizasyon' };

/** Rol grupları — arayüz görünürlüğü (asıl yetki veritabanında RLS ile) */
export const ROLES = {
  kitchenWrite: ['yonetici', 'asci_basi', 'diyetisyen'] as AppRole[],
  finance: ['yonetici', 'muhasebe'] as AppRole[],
  invoices: ['yonetici', 'muhasebe', 'satinalma'] as AppRole[],
  orders: ['yonetici', 'muhasebe', 'asci_basi', 'pazarlamaci'] as AppRole[],
  customersWrite: ['yonetici', 'muhasebe', 'pazarlamaci'] as AppRole[],
  production: ['yonetici', 'asci_basi', 'diyetisyen'] as AppRole[],
};

/** Doğrama biçimleri (iş emrine basılır) */
export const CUT_STYLES = ['küp', 'julyen', 'halka', 'yarım ay', 'rende', 'kıyım', 'brunoise', 'dilim', 'bütün', 'parça'] as const;
/** Saklama / sevk kapları */
export const CONTAINER_TYPES = ['GN 1/1 (65 mm)', 'GN 1/1 (100 mm)', 'GN 1/2', 'GN 1/3', 'Küvet', 'Termobox', '3 bölmeli kap', 'Çorba kasesi', 'Sefer tası'] as const;
/** Üretim istasyonları */
export const STATIONS: Record<string, string> = { hazirlik: 'Hazırlık', pisirme: 'Pişirme', soguk: 'Soğuk mutfak', paketleme: 'Paketleme' };
